import type { TextRegionResult } from "../phase2/types.ts";
import type { TableEvidence, TableRegionResult } from "../phase3/types.ts";

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
  extracted_data?: TextRegionResult | TableRegionResult | null;
};

export type RegionToPersist = ClassifiedRegion & { extracted_data?: TextRegionResult | TableRegionResult | null };

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
}
