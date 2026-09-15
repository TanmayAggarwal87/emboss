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
    regions: ClassifiedRegion[],
  ): Promise<PersistedRegion[]>;
  markJobFailed(jobId: string, message: string): Promise<void>;
}
