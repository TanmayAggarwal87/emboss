import type { GeometryState } from "./tactile-geometry/types"
import type { TextRegionResult } from "./text-processing/types"
import type { TableRegionResult } from "./table-processing/types"
import type { DiagramRegionResult } from "./diagram-extraction/types"

export type WorkflowStep = "upload" | "processing" | "review" | "export"

export type RegionType = "text" | "table" | "diagram"

export type ReviewStatus = "pending" | "approved" | "edit_requested" | "rejected"

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export type TextExtractedData = TextRegionResult
export type TableExtractedData = TableRegionResult
export type DiagramExtractedData = DiagramRegionResult
export type ExtractedData = TextExtractedData | TableExtractedData | DiagramExtractedData

export interface SourcePreview {
  url?: string
  data_url?: string
  error?: string
  expires_at?: string
}

export interface PersistedRegionItem {
  id: string
  job_id: string
  page_number: number
  type: RegionType
  bounding_box: BoundingBox
  review_status: ReviewStatus
  extracted_data?: ExtractedData | null
  geometry?: GeometryState | null
  source_preview?: SourcePreview
}

export interface PageSummary {
  page_number: number
  status: "classified" | "failed"
  raster?: { width: number; height: number }
  has_text_layer?: boolean
  text_processing?: "complete" | "partial_failure"
  table_processing?: "complete" | "partial_failure"
  diagram_processing?: "complete" | "partial_failure"
  geometry_processing?: "complete" | "partial_failure"
  regions: PersistedRegionItem[]
  error?: string
  error_code?: string
  retryable?: boolean
}

export interface RetryInfo {
  url: string
  eligible_pages: number[]
  expires_at: string
  remaining_requests: number
  available_after: string
}

export interface JobApiResponse {
  job_id?: string
  status?: "processing" | "ready_for_review" | "failed" | "exported"
  page_count?: number
  pages?: PageSummary[]
  retry?: RetryInfo
  retry_url?: string
  error?: {
    code: string
    message: string
  }
}
