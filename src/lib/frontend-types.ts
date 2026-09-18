import type { GeometryState } from "./phase5/types"

export type WorkflowStep = "upload" | "processing" | "review" | "export"

export type RegionType = "text" | "table" | "diagram"

export type ReviewStatus = "pending" | "approved" | "edit_requested" | "rejected"

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface TextExtractedData {
  kind: "text"
  status: "processed" | "failed"
  source?: "text_layer" | "ocr"
  plain_text?: string
  braille?: string
  braille_grade?: 1 | 2
  braille_code?: "UEB"
  translation_table?: string
  liblouis_version?: string
  ocr_confidence?: number | null
  warnings?: string[]
  error?: { code: string; message: string }
}

export interface TableExtractedData {
  kind: "table"
  status: "processed" | "failed"
  source?: "text_layer"
  headers?: string[]
  rows?: string[][]
  braille_headers?: string[]
  braille_rows?: string[][]
  braille_pages?: string[]
  layout?: "aligned" | "vertical_list"
  column_widths_cells?: number[]
  column_alignment?: ("left" | "right")[]
  braille_grade?: 1 | 2
  braille_code?: "UEB"
  translation_table?: string
  liblouis_version?: string
  warnings?: string[]
  error?: { code: string; message: string }
}

export interface DiagramExtractedData {
  kind: "diagram"
  status: "processed" | "failed"
  source?: "gemini"
  data?: {
    chart_type: "bar_chart" | "line_graph_single_series"
    axis_labels: { x: string | null; y: string | null }
    data_points: { label: string; value: number | null }[]
    series_label: string | null
  }
  needs_data_review?: boolean
  warnings?: string[]
  geometry_processing?: {
    status: "validated" | "failed"
    error?: { code: string; message: string }
  }
  error?: { code: string; message: string }
}

export type ExtractedData = TextExtractedData | TableExtractedData | DiagramExtractedData | any

export interface PersistedRegionItem {
  id: string
  job_id: string
  page_number: number
  type: RegionType
  bounding_box: BoundingBox
  review_status: ReviewStatus
  extracted_data: ExtractedData | null
  geometry: GeometryState | null
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
