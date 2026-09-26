import type { TextRegionResult } from "../text-processing/types.ts";
import type { TableEvidence, TableRegionResult } from "../table-processing/types.ts";
import type { DiagramRegionResult } from "../diagram-extraction/types.ts";
import type { GeometryState } from "../tactile-geometry/types.ts";

export type RegionType = "text" | "diagram" | "table";

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ClassifiedRegion = {
  region_id: string;
  type: RegionType;
  bounding_box: BoundingBox;
};

export type RasterizedPage = {
  pageNumber: number;
  width: number;
  height: number;
  pngBase64: string;
  hasTextLayer: boolean;
};

export type PersistedRegion = {
  id: string;
  type: RegionType;
  bounding_box: BoundingBox;
  review_status: "pending";
  extracted_data?: TextRegionResult | TableRegionResult | DiagramRegionResult | null;
  geometry?: GeometryState | null;
  // Response-only metadata. Crops never enter database records.
  source_preview?: { url?: string; data_url?: string; expires_at?: string; error?: string };
};

export type RegionToPersist = ClassifiedRegion & {
  extracted_data?: TextRegionResult | TableRegionResult | DiagramRegionResult | null;
  geometry?: GeometryState | null;
};

export type Phase1Config = {
  maxPdfPages: number;
  maxUploadBytes: number;
  uploadsPerIp: number;
  maxGeminiValidationAttempts: number;
};

export interface PdfDocumentHandle {
  readonly pageCount: number;
  rasterizePage(pageIndex: number): RasterizedPage;
  extractTextRegion(pageIndex: number, box: BoundingBox): string;
  rasterizeRegion(pageIndex: number, box: BoundingBox): Uint8Array;
  inspectTableRegion(pageIndex: number, box: BoundingBox): TableEvidence;
  destroy(): void;
}

export interface RegionClassifier {
  classify(
    page: RasterizedPage,
    maxValidationAttempts: number,
    signal?: AbortSignal,
    jobId?: string,
  ): Promise<ClassifiedRegion[]>;
}

export interface JobRepository {
  createJob(pageCount: number): Promise<string>;
  insertRegions(
    jobId: string,
    pageNumber: number,
    regions: RegionToPersist[],
  ): Promise<PersistedRegion[]>;
  markJobFailed(jobId: string, message: string): Promise<void>;
  markJobProcessing?(jobId: string): Promise<void>;
  markJobReady?(jobId: string): Promise<void>;
}
