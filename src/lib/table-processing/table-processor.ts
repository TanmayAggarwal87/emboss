import "server-only";

import type { BoundingBox, PdfDocumentHandle } from "../document-processing/types.ts";
import { TextProcessingError } from "../text-processing/errors.ts";
import type { BrailleGrade } from "../text-processing/types.ts";
import { extractTable } from "./extract-table.ts";
import { formatTable } from "./format-table.ts";
import { TableProcessingError, type TableOutcome, type TableProcessor } from "./types.ts";

export class TableRegionProcessor implements TableProcessor {
  constructor(private readonly grade: BrailleGrade) {}

  process(document: PdfDocumentHandle, pageIndex: number, box: BoundingBox): TableOutcome {
    try {
      const evidence = document.inspectTableRegion(pageIndex, box);
      // Region-local image evidence matters even on pages with selectable text.
      // Phase 4 will consume the rerouted region. No Call B or OCR happens here.
      if (evidence.images.length > 0) return { type: "diagram", extracted_data: null };
      return { type: "table", extracted_data: formatTable(extractTable(evidence), this.grade) };
    } catch (error) {
      const known = error instanceof TableProcessingError || error instanceof TextProcessingError;
      return {
        type: "table",
        extracted_data: { kind: "table", status: "failed", error: known
          ? { code: error.code, message: error.message }
          : { code: "TABLE_EXTRACTION_FAILED", message: "This table could not be read reliably. Other regions can still continue." } },
      };
    }
  }
}
