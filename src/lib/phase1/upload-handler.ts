import {
  ClassificationServiceError,
  ClassificationValidationError,
  UploadError,
} from "./errors.ts";
import { getClientIp, UploadRateLimiter } from "./rate-limit.ts";
import type {
  JobRepository,
  PdfDocumentHandle,
  Phase1Config,
  RegionClassifier,
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
            const regions = await dependencies.repository.insertRegions(
              jobId,
              pageNumber,
              classifications,
            );

            pages.push({
              page_number: pageNumber,
              status: "classified" as const,
              raster: { width: page.width, height: page.height },
              has_text_layer: page.hasTextLayer,
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

        if (allPagesFailed) {
          await dependencies.repository.markJobFailed(
            jobId,
            "No pages could be classified reliably.",
          );
        }

        return Response.json(
          {
            job_id: jobId,
            status: allPagesFailed ? "failed" : "processing",
            page_count: document.pageCount,
            pages,
          },
          {
            status: allPagesFailed ? 422 : failedPages.length > 0 ? 207 : 201,
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
