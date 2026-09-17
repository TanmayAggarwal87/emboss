import type { BoundingBox, PdfDocumentHandle } from "../phase1/types.ts";
import type { DiagramData, SupportedDiagramData } from "./schema.ts";

export type DiagramRegionResult =
  | {
      kind: "diagram";
      status: "processed";
      source: "gemini";
      data: SupportedDiagramData;
      needs_data_review: boolean;
      warnings: string[];
    }
  | { kind: "diagram"; status: "failed"; error: { code: string; message: string } };

export interface DiagramExtractor {
  extract(png: Uint8Array, maxAttempts: number): Promise<DiagramData>;
}

export interface DiagramProcessor {
  process(document: PdfDocumentHandle, pageIndex: number, box: BoundingBox,
    maxAttempts: number): Promise<DiagramRegionResult>;
}
