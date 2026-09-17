import {
  ClassificationServiceError,
  ClassificationValidationError,
  UploadError,
} from "./errors.ts";
import { getClientIp, UploadRateLimiter } from "./rate-limit.ts";
import type { TextProcessor } from "../phase2/types.ts";
import type { TableProcessor } from "../phase3/types.ts";
import type {
  JobRepository,
  PdfDocumentHandle,
  Phase1Config,
  RegionClassifier,
  RegionToPersist,
} from "./types.ts";
import {
  readValidatedPdf,
  validatePageCount,
} from "./upload-validation.ts";

type UploadDependencies = {
  config: Phase1Config;
  rateLimiter: UploadRateLimiter;
  openPdf(bytes: Uint8Array): PdfDocumentHandle;
  classifier: RegionClassifier;
  repository: JobRepository;
  textProcessor: TextProcessor;
  tableProcessor: TableProcessor;
};

export function createUploadHandler(dependencies: UploadDependencies) {
  return async function handleUpload(request: Request): Promise<Response> {
    try {
      const clientIp = getClientIp(request);
      if (
        !dependencies.rateLimiter.consume(
          clientIp,
          dependencies.config.uploadsPerIp,
        )
      ) {
        throw new UploadError(
          429,
          "RATE_LIMITED",
          "This device has reached the upload limit. Please try again later.",
        );
      }

      const bytes = await readValidatedPdf(
        request,
        dependencies.config.maxUploadBytes,
      );
      const document = openDocumentSafely(dependencies, bytes);

      try {
        validatePageCount(
          document.pageCount,
          dependencies.config.maxPdfPages,
        );

        const jobId = await dependencies.repository.createJob(document.pageCount);
        const pages = [];

        for (let pageIndex = 0; pageIndex < document.pageCount; pageIndex += 1) {
          const pageNumber = pageIndex + 1;

          try {
            const page = document.rasterizePage(pageIndex);
            const classifications = await dependencies.classifier.classify(
              page,
              dependencies.config.maxGeminiValidationAttempts,
            );
            const processed: RegionToPersist[] = [];
            for (const region of classifications) {
              if (region.type === "text") {
                processed.push({ ...region,
                  extracted_data: await dependencies.textProcessor.process(document, page, region.bounding_box) });
              } else if (region.type === "table") {
                processed.push({ ...region, ...dependencies.tableProcessor.process(document, pageIndex, region.bounding_box) });
              } else {
                processed.push(region);
              }
            }
            const regions = await dependencies.repository.insertRegions(
              jobId,
              pageNumber,
              processed,
            );

            pages.push({
              page_number: pageNumber,
              status: "classified" as const,
              raster: { width: page.width, height: page.height },
              has_text_layer: page.hasTextLayer,
              text_processing: processed.some((region) => region.type === "text" && region.extracted_data?.status === "failed")
                ? "partial_failure" as const : "complete" as const,
              table_processing: processed.some((region) => region.type === "table" && region.extracted_data?.status === "failed")
                ? "partial_failure" as const : "complete" as const,
              regions,
            });
          } catch (error) {
            pages.push({
              page_number: pageNumber,
              status: "failed" as const,
              error: pageErrorMessage(error, pageNumber),
            });
          }
        }

        const failedPages = pages.filter((page) => page.status === "failed");
        const allPagesFailed = failedPages.length === document.pageCount;
        const hasRegionFailures = pages.some((page) => page.status === "classified" &&
          (page.text_processing === "partial_failure" || page.table_processing === "partial_failure"));
        const allRegions = pages.flatMap((page) => page.status === "classified" ? page.regions : []);
        const allRegionsFailed = !allPagesFailed && allRegions.length > 0 &&
          allRegions.every((region) => region.extracted_data?.status === "failed");
        const jobFailed = allPagesFailed || allRegionsFailed;

        if (jobFailed) {
          await dependencies.repository.markJobFailed(
            jobId,
            allPagesFailed ? "No pages could be classified reliably." : "No regions could be processed successfully.",
          );
        }

        return Response.json(
          {
            job_id: jobId,
            status: jobFailed ? "failed" : "processing",
            page_count: document.pageCount,
            pages,
          },
          {
            status: jobFailed ? 422 : failedPages.length > 0 || hasRegionFailures ? 207 : 201,
          },
        );
      } finally {
        document.destroy();
      }
    } catch (error) {
      if (error instanceof UploadError) {
        return Response.json(
          { error: { code: error.code, message: error.message } },
          { status: error.status },
        );
      }

      console.error("Unexpected Phase 1 upload failure.", error);
      return Response.json(
        {
          error: {
            code: "UPLOAD_FAILED",
            message: "The document could not be processed. Please try again.",
          },
        },
        { status: 500 },
      );
    }
  };
}

function openDocumentSafely(
  dependencies: UploadDependencies,
  bytes: Uint8Array,
): PdfDocumentHandle {
  try {
    return dependencies.openPdf(bytes);
  } catch (error) {
    if (error instanceof UploadError) {
      throw error;
    }

    throw new UploadError(
      422,
      "INVALID_PDF",
      "This PDF could not be opened. It may be damaged or password-protected.",
    );
  }
}

function pageErrorMessage(error: unknown, pageNumber: number): string {
  if (error instanceof ClassificationValidationError) {
    return `Page ${pageNumber} could not be classified reliably after the configured validation attempts.`;
  }

  if (error instanceof UploadError) {
    return error.message;
  }

  if (error instanceof ClassificationServiceError) {
    return `Page ${pageNumber} could not be classified because the analysis service was unavailable. The rest of the document can still continue.`;
  }

  return `Page ${pageNumber} could not be prepared or classified. The rest of the document can still continue.`;
}
