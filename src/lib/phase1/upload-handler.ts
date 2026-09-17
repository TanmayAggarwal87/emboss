import { z } from "zod";
import { ClassificationServiceError, ClassificationValidationError, UploadError } from "./errors.ts";
import { getClientIp, UploadRateLimiter } from "./rate-limit.ts";
import { RetrySessionStore, type ClassifiedPage, type FailedPage, type RetrySession } from "./retry-sessions.ts";
import type { TextProcessor } from "../phase2/types.ts";
import type { TableProcessor } from "../phase3/types.ts";
import type { DiagramProcessor } from "../phase4/types.ts";
import type { GeometryProcessor } from "../phase5/types.ts";
import type { JobRepository, PdfDocumentHandle, Phase1Config, RegionClassifier, RegionToPersist } from "./types.ts";
import { readValidatedPdf, validatePageCount } from "./upload-validation.ts";

export type UploadDependencies = {
  config: Phase1Config;
  rateLimiter: UploadRateLimiter;
  openPdf(bytes: Uint8Array): PdfDocumentHandle;
  classifier: RegionClassifier;
  repository: JobRepository;
  textProcessor: TextProcessor;
  tableProcessor: TableProcessor;
  diagramProcessor: DiagramProcessor;
  geometryProcessor?: GeometryProcessor;
  sessions?: RetrySessionStore;
};

// Reserve time for the current downstream region and DB writes before the
// route's 600-second host allowance (Call B can take three 60-second attempts).
// This is a cooperative pipeline deadline, not a background processing queue.
const REQUEST_BUDGET_MS = 180_000;
const MANUAL_RETRY_COOLDOWN_MS = 60_000;
const MAX_MANUAL_RETRIES = 3;

export function createUploadHandler(dependencies: UploadDependencies) {
  const sessions = dependencies.sessions ?? new RetrySessionStore();
  return async (request: Request): Promise<Response> => {
    let session: RetrySession | undefined;
    let document: PdfDocumentHandle | undefined;
    try {
      consumeRequest(dependencies, request);
      const bytes = await readValidatedPdf(request, dependencies.config.maxUploadBytes);
      document = openDocumentSafely(dependencies, bytes);
      validatePageCount(document.pageCount, dependencies.config.maxPdfPages);
      session = sessions.reserve(bytes, document.pageCount);
      session.jobId = await dependencies.repository.createJob(document.pageCount);
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_BUDGET_MS)]);
      for (let page = 1; page <= document.pageCount; page += 1) {
        await processPage(dependencies, session, document, page, signal);
      }
      await syncJobStatus(dependencies.repository, session, !!dependencies.geometryProcessor);
      session.retryNotBefore = sessions.now() + MANUAL_RETRY_COOLDOWN_MS;
      return sessionResponse(session, sessions, false);
    } catch (error) {
      if (session && !session.jobId) sessions.remove(session);
      return errorResponse(error, session);
    } finally {
      document?.destroy();
      if (session) sessions.release(session);
    }
  };
}

export function createRetryHandler(dependencies: UploadDependencies & { sessions: RetrySessionStore }) {
  const { sessions } = dependencies;
  return async (request: Request, jobId: string): Promise<Response> => {
    let session: RetrySession | undefined;
    let document: PdfDocumentHandle | undefined;
    let locked = false;
    let attempted = false;
    try {
      consumeRequest(dependencies, request);
      if (!z.uuid().safeParse(jobId).success) throw new UploadError(400, "INVALID_JOB_ID", "Choose a valid document job.");
      const selected = await readRetryPages(request);
      session = sessions.get(jobId);
      if (session.busy) throw new UploadError(409, "RETRY_IN_PROGRESS", "This document is already being processed. Wait for the current request to finish.");
      if (selected.some((page) => page > session!.pageCount)) throw new UploadError(400, "INVALID_PAGES", "A requested page does not belong to this document.");
      const failures = session.pages.filter((page): page is FailedPage => page.status === "failed" && selected.includes(page.page_number));
      if (failures.some((page) => !page.retryable)) throw new UploadError(409, "PAGE_NOT_RETRYABLE", "A selected page has a permanent error. Check its error message before uploading a corrected document.");
      // Replay completed requests from cached metadata without rerunning AI.
      if (!failures.length) {
        session.busy = true;
        locked = true;
        await syncJobStatus(dependencies.repository, session, !!dependencies.geometryProcessor);
        return sessionResponse(session, sessions, true);
      }
      if (session.retries >= MAX_MANUAL_RETRIES) throw new UploadError(429, "RETRY_LIMIT_REACHED", "This document has reached its three retry-request limit.");
      if (session.retryNotBefore > sessions.now()) throw new UploadError(429, "RETRY_COOLDOWN", "Please wait one minute before retrying this document again.");
      if (!session.bytes) throw new UploadError(410, "RETRY_SESSION_EXPIRED", "The temporary PDF is no longer available. Upload it again to start a new job.");
      session.busy = true;
      locked = true;
      session.retries += 1;
      attempted = true;
      document = openDocumentSafely(dependencies, session.bytes);
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_BUDGET_MS)]);
      for (const page of failures.sort((a, b) => a.page_number - b.page_number)) {
        await processPage(dependencies, session, document, page.page_number, signal);
      }
      await syncJobStatus(dependencies.repository, session, !!dependencies.geometryProcessor);
      session.retryNotBefore = sessions.now() + MANUAL_RETRY_COOLDOWN_MS;
      return sessionResponse(session, sessions, true);
    } catch (error) {
      return errorResponse(error, locked ? session : undefined);
    } finally {
      document?.destroy();
      if (locked && session) {
        if (attempted) session.retryNotBefore = sessions.now() + MANUAL_RETRY_COOLDOWN_MS;
        sessions.release(session);
      }
    }
  };
}

async function processPage(dependencies: UploadDependencies, session: RetrySession,
  document: PdfDocumentHandle, pageNumber: number, signal: AbortSignal): Promise<void> {
  try {
    signal.throwIfAborted();
    let prepared = session.prepared.get(pageNumber);
    if (!prepared) {
      const raster = document.rasterizePage(pageNumber - 1);
      const classifications = await dependencies.classifier.classify(raster, dependencies.config.maxGeminiValidationAttempts, signal);
      prepared = { raster: { width: raster.width, height: raster.height }, hasTextLayer: raster.hasTextLayer,
        classifications, processed: [] };
      session.prepared.set(pageNumber, prepared);
    }
    // Checkpoint every region: a DB failure/deadline must not bill its AI again.
    for (const region of prepared.classifications.slice(prepared.processed.length)) {
      signal.throwIfAborted();
      let result: RegionToPersist = region;
      if (region.type === "text") {
        result = { ...region, extracted_data: await dependencies.textProcessor.process(document,
          { pageNumber, ...prepared.raster, hasTextLayer: prepared.hasTextLayer, pngBase64: "" }, region.bounding_box) };
      } else if (region.type === "table") {
        result = { ...region, ...dependencies.tableProcessor.process(document, pageNumber - 1, region.bounding_box) };
      }
      if (result.type === "diagram") {
        result = { ...result, extracted_data: await dependencies.diagramProcessor.process(document,
          pageNumber - 1, result.bounding_box, dependencies.config.maxGeminiValidationAttempts) };
        if (result.extracted_data?.kind === "diagram" && result.extracted_data.status === "processed" && dependencies.geometryProcessor) {
          const generated = dependencies.geometryProcessor.process(result.extracted_data.data);
          result = { ...result, geometry: generated.status === "validated" ? generated.geometry : null,
            extracted_data: { ...result.extracted_data,
              warnings: [...result.extracted_data.warnings, ...(generated.status === "validated" ? generated.warnings : [])],
              geometry_processing: generated.status === "validated" ? { status: "validated" } : { status: "failed", error: generated.error } } };
        }
      }
      prepared.processed.push(result);
    }
    const regions = await dependencies.repository.insertRegions(session.jobId!, pageNumber, prepared.processed);
    const failed = (type: string) => prepared.processed.some((region) => region.type === type && region.extracted_data?.status === "failed");
    session.pages[pageNumber - 1] = {
      page_number: pageNumber, status: "classified", raster: prepared.raster, has_text_layer: prepared.hasTextLayer,
      text_processing: failed("text") ? "partial_failure" : "complete",
      table_processing: failed("table") ? "partial_failure" : "complete",
      diagram_processing: failed("diagram") ? "partial_failure" : "complete",
      ...(dependencies.geometryProcessor ? { geometry_processing: prepared.processed.some((r) => r.extracted_data?.kind === "diagram" &&
        (r.extracted_data.status === "failed" || r.extracted_data.geometry_processing?.status === "failed")) ? "partial_failure" as const : "complete" as const } : {}), regions,
    };
    session.prepared.delete(pageNumber);
  } catch (error) {
    session.pages[pageNumber - 1] = pageFailure(error, pageNumber, signal.aborted);
  }
}

function jobFailed(session: RetrySession): boolean {
  const classified = session.pages.filter((page): page is ClassifiedPage => page.status === "classified");
  const regions = classified.flatMap((page) => page.regions);
  return !classified.length || (regions.length > 0 && regions.every((region) => region.extracted_data?.status === "failed" ||
    (region.extracted_data?.kind === "diagram" && region.extracted_data.geometry_processing?.status === "failed")));
}

async function syncJobStatus(repository: JobRepository, session: RetrySession, geometryEnabled: boolean): Promise<void> {
  if (jobFailed(session)) {
    session.failedInDatabase = true;
    session.reviewReady = false;
    await repository.markJobFailed(session.jobId!, "No pages or regions could be processed successfully.");
  } else if (geometryEnabled && repository.markJobReady && session.pages.length === session.pageCount &&
    session.pages.some((page) => page.status === "classified" && page.regions.length > 0) &&
    session.pages.every((page) => page.status === "classified" && page.regions.every((region) =>
      region.extracted_data?.status === "processed" && (region.type !== "diagram" ||
        (region.extracted_data.kind === "diagram" && region.extracted_data.geometry_processing?.status === "validated" && !!region.geometry))))) {
    await repository.markJobReady(session.jobId!);
    session.failedInDatabase = false;
    session.reviewReady = true;
  } else if (session.failedInDatabase) {
    if (!repository.markJobProcessing) throw new UploadError(503, "DATABASE_ERROR", "The recovered results were saved, but the job status could not be updated.");
    await repository.markJobProcessing(session.jobId!);
    session.failedInDatabase = false;
  }
}

function sessionResponse(session: RetrySession, sessions: RetrySessionStore, retry: boolean): Response {
  const failed = jobFailed(session);
  const partial = session.pages.some((page) => page.status === "failed" ||
    [page.text_processing, page.table_processing, page.diagram_processing, page.geometry_processing].includes("partial_failure"));
  const retryable = session.pages.filter((page) => page.status === "failed" && page.retryable).map((page) => page.page_number);
  return Response.json({ job_id: session.jobId, status: failed ? "failed" : session.reviewReady ? "ready_for_review" : "processing",
    page_count: session.pageCount, pages: session.pages,
    retry: { url: `/api/jobs/${session.jobId}/retry`, eligible_pages: retryable,
      expires_at: new Date(session.expiresAt).toISOString(), remaining_requests: MAX_MANUAL_RETRIES - session.retries,
      available_after: new Date(Math.max(sessions.now(), session.retryNotBefore)).toISOString() },
  }, { status: failed ? 422 : partial ? 207 : retry ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}

async function readRetryPages(request: Request): Promise<number[]> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new UploadError(415, "INVALID_CONTENT_TYPE", "Send the page numbers as JSON.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new UploadError(400, "INVALID_PAGES", "Provide a pages array.");
  let content = "";
  let size = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        throw new UploadError(413, "RETRY_BODY_TOO_LARGE", "The retry request is too large.");
      }
      content += decoder.decode(value, { stream: true });
    }
    content += decoder.decode();
  } finally { reader.releaseLock(); }
  try {
    const parsed = z.object({ pages: z.array(z.number().int().min(1).max(3)).min(1).max(3) }).strict().parse(JSON.parse(content));
    if (new Set(parsed.pages).size !== parsed.pages.length) throw new Error("Duplicate pages");
    return parsed.pages;
  } catch { throw new UploadError(400, "INVALID_PAGES", 'Provide distinct page numbers in a pages array, for example {"pages":[2]}.'); }
}

function consumeRequest(dependencies: UploadDependencies, request: Request): void {
  if (!dependencies.rateLimiter.consume(getClientIp(request), dependencies.config.uploadsPerIp)) {
    throw new UploadError(429, "RATE_LIMITED", "This device has reached the upload/retry request limit. Please try again later.");
  }
}

function openDocumentSafely(dependencies: UploadDependencies, bytes: Uint8Array): PdfDocumentHandle {
  try { return dependencies.openPdf(bytes); }
  catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError(422, "INVALID_PDF", "This PDF could not be opened. It may be damaged or password-protected.");
  }
}

function pageFailure(error: unknown, page: number, aborted: boolean): FailedPage {
  let code = "PAGE_PROCESSING_FAILED";
  let message = `Page ${page} could not be prepared or classified. The rest of the document can still continue.`;
  let retryable = true;
  if (aborted) {
    code = "REQUEST_INTERRUPTED";
    message = `Page ${page} was interrupted or exceeded the request time budget. Retry this page without resending successful pages.`;
  } else if (error instanceof ClassificationServiceError) {
    code = error.httpStatus === 429 ? "GEMINI_RATE_LIMITED" : "GEMINI_SERVICE_UNAVAILABLE";
    retryable = error.httpStatus === undefined || error.httpStatus === 429 || error.httpStatus === 503;
    message = error.httpStatus === 429
      ? `Page ${page} reached the analysis service's request limit after bounded retries. Wait before retrying this page.`
      : `Page ${page} could not be classified because the analysis service was unavailable${error.httpStatus === 503 ? " after bounded retries" : ""}. The rest of the document can still continue.`;
    if (!retryable) message = `Page ${page} was rejected by the analysis service (HTTP ${error.httpStatus}). Check the service configuration; this error is not automatically retried.`;
  } else if (error instanceof ClassificationValidationError) {
    code = "CLASSIFICATION_INVALID";
    message = `Page ${page} could not be classified reliably after the configured validation attempts.`;
  } else if (error instanceof UploadError) {
    code = error.code;
    message = error.message;
    retryable = error.status >= 500;
  }
  return { page_number: page, status: "failed", error: message, error_code: code, retryable };
}

function errorResponse(error: unknown, session?: RetrySession): Response {
  const known = error instanceof UploadError;
  return Response.json({ ...(session?.jobId ? { job_id: session.jobId, pages: session.pages,
    retry_url: `/api/jobs/${session.jobId}/retry` } : {}), error: { code: known ? error.code : "UPLOAD_FAILED",
    message: known ? error.message : "The document could not be processed. Please try again." } },
  { status: known ? error.status : 500, headers: { "Cache-Control": "no-store",
    ...(known && error.code === "RETRY_COOLDOWN" ? { "Retry-After": "60" } : {}) } });
}
