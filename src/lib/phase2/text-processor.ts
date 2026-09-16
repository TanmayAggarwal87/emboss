import type { BoundingBox, PdfDocumentHandle, RasterizedPage } from "../phase1/types.ts";
import { translateBraille } from "./braille.ts";
import { TextProcessingError } from "./errors.ts";
import type { BrailleGrade, TextProcessor, TextRecognizer, TextRegionResult } from "./types.ts";

export class TextRegionProcessor implements TextProcessor {
  constructor(private readonly grade: BrailleGrade, private readonly ocr: TextRecognizer) {}

  async process(document: PdfDocumentHandle, page: RasterizedPage, box: BoundingBox): Promise<TextRegionResult> {
    try {
      let text: string;
      let confidence: number | null = null;
      if (page.hasTextLayer) {
        text = document.extractTextRegion(page.pageNumber - 1, box);
      } else {
        // OCR is only for pages with no real text layer, never a silent fallback
        // when a detected box on a text-bearing page happens to extract nothing.
        const result = await this.ocr.recognize(document.rasterizeRegion(page.pageNumber - 1, box));
        text = result.text;
        confidence = result.confidence;
      }
      if (!text.trim()) {
        throw new TextProcessingError("TEXT_REGION_EMPTY", page.hasTextLayer
          ? "No readable PDF text was found inside this region. Check its detected bounds or use a PDF with a valid text layer."
          : "OCR could not read text in this scanned region. Please use a clearer scan.");
      }
      const translation = translateBraille(text, this.grade);
      return {
        kind: "text", status: "processed", source: page.hasTextLayer ? "text_layer" : "ocr",
        plain_text: text, braille: translation.braille, braille_grade: this.grade,
        braille_code: "UEB", translation_table: translation.table,
        liblouis_version: translation.version, ocr_confidence: confidence,
        warnings: page.hasTextLayer ? [] : ["Text was read using OCR. Check it against the scan before approving the braille."],
      };
    } catch (error) {
      return {
        kind: "text", status: "failed",
        error: error instanceof TextProcessingError
          ? { code: error.code, message: error.message }
          : { code: "TEXT_EXTRACTION_FAILED", message: "This text region could not be read. Other regions can still continue." },
      };
    }
  }
}
