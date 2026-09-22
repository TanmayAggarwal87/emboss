import type { BoundingBox, PdfDocumentHandle, RasterizedPage } from "../document-processing/types.ts";

export type BrailleGrade = 1 | 2;

export type TextRegionResult =
  | {
      kind: "text";
      status: "processed";
      source: "text_layer" | "ocr";
      plain_text: string;
      braille: string;
      braille_grade: BrailleGrade;
      braille_code: "UEB";
      translation_table: string;
      liblouis_version: string;
      ocr_confidence: number | null;
      warnings: string[];
    }
  | {
      kind: "text";
      status: "failed";
      error: { code: string; message: string };
    };

export interface TextProcessor {
  process(
    document: PdfDocumentHandle,
    page: RasterizedPage,
    box: BoundingBox,
  ): Promise<TextRegionResult>;
}

export interface TextRecognizer {
  recognize(png: Uint8Array): Promise<{ text: string; confidence: number }>;
}
