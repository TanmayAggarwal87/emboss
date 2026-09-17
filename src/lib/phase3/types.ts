import type { BoundingBox, PdfDocumentHandle } from "../phase1/types.ts";
import type { BrailleGrade } from "../phase2/types.ts";

export type Rectangle = [number, number, number, number];
export type TableCharacter = { text: string; bounds: Rectangle; line: number; bold: boolean };
export type Rule = { position: number; start: number; end: number };
export type TableEvidence = {
  characters: TableCharacter[];
  images: Rectangle[];
  horizontal: Rule[];
  vertical: Rule[];
  clippedText: boolean;
  rotatedText: boolean;
};
export type PlainTable = { headers: string[]; rows: string[][]; structure: "ruled" | "aligned" };
export type TableRegionResult =
  | {
      kind: "table";
      status: "processed";
      source: "text_layer";
      headers: string[];
      rows: string[][];
      braille_headers: string[];
      braille_rows: string[][];
      braille_pages: string[];
      layout: "aligned" | "vertical_list";
      column_widths_cells: number[];
      column_alignment: ("left" | "right")[];
      braille_grade: BrailleGrade;
      braille_code: "UEB";
      translation_table: string;
      liblouis_version: string;
      warnings: string[];
    }
  | { kind: "table"; status: "failed"; error: { code: string; message: string } };

export type TableOutcome =
  | { type: "table"; extracted_data: TableRegionResult }
  | { type: "diagram"; extracted_data: null };

export interface TableProcessor {
  process(document: PdfDocumentHandle, pageIndex: number, box: BoundingBox): TableOutcome;
}

export class TableProcessingError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "TableProcessingError";
  }
}
