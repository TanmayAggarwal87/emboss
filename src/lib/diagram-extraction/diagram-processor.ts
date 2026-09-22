import "server-only";

import type { BoundingBox, PdfDocumentHandle } from "../document-processing/types.ts";
import { DiagramProcessingError } from "./errors.ts";
import type { DiagramExtractor, DiagramProcessor, DiagramRegionResult } from "./types.ts";

export class DiagramRegionProcessor implements DiagramProcessor {
  constructor(private readonly extractor: DiagramExtractor) {}

  async process(document: PdfDocumentHandle, pageIndex: number, box: BoundingBox,
    maxAttempts: number): Promise<DiagramRegionResult> {
    let png: Uint8Array;
    try {
      png = document.rasterizeRegion(pageIndex, box);
    } catch {
      return failure("DIAGRAM_CROP_FAILED", "This diagram could not be cropped from its PDF page. Other regions can still continue.");
    }
    try {
      const data = await this.extractor.extract(png, maxAttempts);
      if (data.chart_type === "unsupported") {
        return failure("DIAGRAM_UNSUPPORTED", "This region is not a supported bar chart or single-series line graph. Other diagram types and image tables are not supported in v1.");
      }
      const missing = data.data_points.some((point) => point.value === null)
        || data.independent_axis.values.some((value) => value === null);
      return {
        kind: "diagram", status: "processed", source: "gemini", data,
        needs_data_review: missing,
        warnings: missing ? ["Some chart values could not be read. Review and resolve the null values before geometry generation."] : [],
      };
    } catch (error) {
      if (error instanceof DiagramProcessingError) return failure(error.code, error.message);
      return failure("DIAGRAM_EXTRACTION_FAILED", "This diagram could not be analyzed. Other regions can still continue.");
    }
  }
}

function failure(code: string, message: string): DiagramRegionResult {
  return { kind: "diagram", status: "failed", error: { code, message } };
}
