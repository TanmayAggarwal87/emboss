# Data Model — Emboss

This file describes persisted state, the job lifecycle, and access pattern. Read
`AGENTS.md` §5 and §9 first — no auth, no file storage bucket, minimal persistence.

---

## What actually needs to persist

Emboss does not keep user history and has no login. The only reason anything touches
the database at all is that a single document's journey through classification →
per-region processing → human review → edit → export happens across multiple
requests in one session, so *something* needs to hold state between those requests.

**Persisted (Supabase Postgres, short-lived):**
- Job status
- Per-region processing state and results (geometry JSON, extracted text/table data,
  review status)

**Not persisted:**
- The uploaded PDF file itself, beyond the lifetime of the active job
- Rendered page rasters, beyond the lifetime of the active job
- Final exported packages, beyond the lifetime of the active job
- Any user identity or account data — there is none

Where the actual PDF bytes / raster images live during processing (in-memory, tmp
disk, or a short-lived object) is an implementation detail, not a schema concern —
just don't reach for a persistent storage bucket to solve it, per AGENTS.md §5.

---

## Access pattern (no auth)

- A job is created on upload and identified by an **unguessable job ID** (e.g. a UUID
  or similarly high-entropy token) — not a sequential/guessable ID.
- The reviewer accesses the job's status/preview/review screens via a URL containing
  that job ID, the same way a Figma or Google Docs share link works — knowledge of
  the URL is the only access control there is in v1.
- Do not build a login, session, or per-user job list. If "what jobs have I created"
  ever becomes a real need, that's a v2 conversation requiring real auth — don't
  half-build it now.
- Jobs should be treated as expiring / cleanable after some reasonable window (exact
  TTL not critical for v1 test scope, but don't design as if job rows live forever).

---

## Proposed tables (draft — adjust during implementation, this isn't sacred)

### `jobs`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | the unguessable job ID used in the share URL |
| `status` | enum | `processing` \| `ready_for_review` \| `exported` \| `failed` |
| `created_at` | timestamp | |
| `page_count` | int | for the v1 1-3 page scope check |
| `error_message` | text, nullable | populated on `failed`, e.g. "diagram too dense for plate size" or "unsupported diagram type" |

### `regions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `job_id` | uuid, FK → jobs | |
| `page_number` | int | |
| `type` | enum | `text` \| `diagram` \| `table` |
| `bounding_box` | jsonb | `{x, y, width, height}` from Stage 2 classification |
| `review_status` | enum | `pending` \| `approved` \| `edit_requested` \| `rejected` |
| `extracted_data` | jsonb | text processing result (text regions; contract below), structured table data (table regions), or structured diagram data from Gemini Call Type B (diagram regions) — see Stage 3c in `docs/pipeline.md` |
| `geometry` | jsonb, nullable | only for diagram regions — the validated geometry/element state, structure TBD (see below) |
| `created_at` / `updated_at` | timestamp | |

### Text region result (Phase 2)

`regions.extracted_data` stores a discriminated result, typed in
`src/lib/text-processing/types.ts`. Successful text results retain both the source and braille:

```ts
{
  kind: "text",
  status: "processed",
  source: "text_layer" | "ocr",
  plain_text: string,
  braille: string, // Unicode six-dot braille; ordinary spaces and newlines retained
  braille_grade: 1 | 2,
  braille_code: "UEB",
  translation_table: string,
  liblouis_version: string,
  ocr_confidence: number | null,
  warnings: string[]
}
```

A failed region instead stores `{ kind: "text", status: "failed", error: { code,
message } }`. Processing failure is not human rejection: `review_status` remains
`pending` in both cases. Do not treat a pending failed region as usable output.
Diagram regions now use the Phase 4 contract below.
No schema migration is required for these JSON values.

Phase 2 runs within the upload request before MuPDF is closed. The response includes
these results per region and `text_processing: "complete" | "partial_failure"` on
classified pages. Partial failures return HTTP 207; if all persisted regions have
failed processing, the job is marked `failed` and HTTP 422 is returned. Successful jobs
remain `processing`; review readiness is deferred to the later pipeline phases.

### Table region result (Phase 3)

`src/lib/table-processing/types.ts` defines the table variant stored in the same JSONB column:

```ts
{
  kind: "table",
  status: "processed",
  source: "text_layer",
  headers: string[],
  rows: string[][],
  braille_headers: string[],
  braille_rows: string[][],
  braille_pages: string[], // each section <=40 cells wide and <=25 lines
  layout: "aligned" | "vertical_list",
  column_widths_cells: number[], // aligned-layout widths, not physical dimensions
  column_alignment: ("left" | "right")[],
  braille_grade: 1 | 2,
  braille_code: "UEB",
  translation_table: string,
  liblouis_version: string,
  warnings: string[]
}
```

Failure stores `{ kind: "table", status: "failed", error: { code, message } }`.
`review_status` stays `pending` for successes and failures; `geometry` stays null.
No migration or Storage bucket is needed. The original PDF remains available in
the temporary retry session described below, not in these JSON values.

MuPDF image evidence inside a table box changes that region's persisted `type` to
`diagram`, preserving its box/page. The upload pipeline then runs Phase 4 Call B
on that region. A genuine image table will be rejected as an unsupported diagram;
rerouting does not enable table OCR or table-data extraction by Gemini.
Unreliable real-text tables fail locally rather than being sent to an AI fallback.

The upload response adds `table_processing: "complete" | "partial_failure"` on
classified pages, independently of `text_processing`. `complete` means no table
processor failed; it does not mean a rerouted diagram has finished processing.
HTTP 207 preserves other regions when one fails. HTTP 422 marks the job failed if
all pages fail or every persisted region failed; otherwise it remains `processing`.

### Diagram region result (Phase 4)

`src/lib/diagram-extraction/types.ts` adds a result to the existing JSONB column; no migration
or Storage bucket is needed:

```ts
{
  kind: "diagram",
  status: "processed", // chart data extracted; geometry processing is separate
  source: "gemini",
  data: {
    chart_type: "bar_chart" | "line_graph_single_series",
    axis_labels: { x: string | null, y: string | null },
    data_points: { label: string, value: number | null }[],
    series_label: string | null
  },
  needs_data_review: boolean,
  warnings: string[]
}
```

When Phase 5 is enabled, successful extraction may additionally produce a
`geometry_processing` result containing validated `GeometryState` and warnings;
geometry failure is local to the region and does not discard the extracted data.

The `data` object is strict Zod-validated Call B output. Extra keys at every level,
non-finite values, empty point labels, and missing fields are rejected. Bar charts
need at least one point, line graphs at least two. Source labels and point ordering
are preserved; chart units in labels are not tactile dimensions.

Unreadable values remain null, set `needs_data_review: true`, and carry a warning.
Future geometry generation must not consume those gaps as zero or interpolate
them silently. All results still require human approval, including complete data.

Unsupported diagrams and processing failures instead store
`{ kind: "diagram", status: "failed", error: { code, message } }`. Raw invalid AI
responses are never persisted. Failure is local to the region and does not mean
human rejection: `review_status` stays `pending`. `geometry` remains null.

Classified pages now include `diagram_processing: "complete" | "partial_failure"`.
Null values needing review are valid extraction output, not failed processing.
HTTP 207/422 behavior remains as above. Jobs remain `processing` until later stages
can supply validated geometry and review readiness; Phase 4 does not set
`ready_for_review`. Crops remain request-local; PDF bytes may outlive a request in
the temporary retry session, but neither is saved to Supabase.

### Temporary page retry state

Failed page status, error codes, retry eligibility, validated classification and
completed region checkpoints are process-local, not new database tables. Source
PDF bytes are retained for a 15-minute retry session (active work is allowed to
finish before eviction); no full page rasters are retained. Completion or permanent page
failures release PDF bytes early. Session count and byte caps are documented in
`docs/pipeline.md`. Restart/expiry/another server instance means HTTP 410, not loss
of saved database results. There is no durable page-status/history API in v1.

Region row IDs are deterministic UUIDv8 hashes of job ID, page number and validated
Call A region ID. Insert-on-conflict-do-nothing followed by read-back makes retries
safe after a lost write acknowledgement without duplicating rows or overwriting
saved review/data. This is a database row key, **not** the future geometry element
ID scheme. Existing region rows need no migration. Successful pages are skipped;
prepared failed pages reuse their analysis rather than paying for Gemini again.
An all-failed job can return to `processing` after page recovery; it is not promoted
to `ready_for_review` by retrying.

### `edits` (optional — only if you want an edit history, not required for v1 function)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `region_id` | uuid, FK → regions | |
| `prompt_text` | text | the reviewer's plain-English instruction |
| `applied_operation` | jsonb | the schema-checked operation the edit agent emitted |
| `created_at` | timestamp | |

This table is a nice-to-have for demoing "here's what human review caught," not a
functional requirement — skip it if it adds friction, add it back if you want that
demo point.

---

### Source preview metadata (Phase 6)

`source_preview` is **response-only metadata** attached to region objects in the
upload and retry API JSON responses (`PersistedRegionItem.source_preview`):

```ts
export interface SourcePreview {
  url?: string;        // e.g. "/api/jobs/<jobId>/regions/<regionId>/source"
  expires_at?: string; // ISO 8601 timestamp (15 minutes from rasterization)
  error?: string;      // Populated if raster crop creation failed
}
```

- **Not persisted in Postgres**: The `regions` table does NOT contain a `source_preview`
  column. Database rows store only `bounding_box`, `extracted_data`, `geometry`, and
  `review_status`.
- **Not stored in Supabase Storage**: No storage buckets are used in v1 (`AGENTS.md` §5).
  The high-resolution PNG bytes are cached strictly in Node.js process memory using a
  bounded LRU cache (50 MB limit, 15-minute TTL).
- **Temporary URL & Expiry (HTTP 410)**: The URL `/api/jobs/[jobId]/regions/[regionId]/source`
  serves the exact PNG bytes privately (`Cache-Control: private, no-store`). When the
  in-memory TTL expires, or if the server process restarts or another serverless replica
  receives the request, the endpoint returns **HTTP 410 Gone**.
- **Non-blocking for geometry/review**: Expiry of a source preview does not alter or invalidate
  the region's persisted geometry or review status in Postgres. The review UI cleanly displays
  an expired notice while preserving 3D tactile inspection.

---

## Phase 5 diagram geometry state and element IDs

`regions.geometry` stores a validated `GeometryState` JSON value (schema version `1`,
`units: "mm"`), never a mesh blob or mesh file. It contains the validated Phase 4
source contract, which supports only bar charts and single-series line graphs. The
independent axis is aligned with the source: numeric or categorical values are
one-to-one with data points; vertical bars and line graphs use x, horizontal bars use
y. Graphic dimensions are deterministic and the braille profile is fixed.

Element IDs are scoped to one region and are never renumbered by future edits:
`bar-0`, `point-0`, `data-segment-0`, `x-axis`, `y-axis`, `grid-y-0`, `grid-x-0`,
`label-x-0`, `label-y-0`, `label-x-title`, `label-y-title`, and `legend-0`.
`title` is reserved for a future title only when an actual title exists. These IDs
are semantic addresses preserved in state and in the preview scene graph. The same
`buildGeometryMesh` group is intended for future preview and export; binary STL does
not preserve semantic IDs, so do not claim that an STL file does.

Phase 5 uses additive, closed solids (including overlapping solids) and no CSG.
Slicing and printer-specific checks remain future work.

---

## Job lifecycle (state transitions)

```
upload
  → processing (Stages 1-3 running)
  → ready_for_review (all pages/regions complete and every diagram has validated geometry;
    at least one region needs review — never auto-approve)
      → [per region] approved / edit_requested / rejected
      → once all regions are in a terminal per-region state (approved or rejected):
  → exported (Stage 6-7 complete, package generated)

  → failed (at any stage — e.g. unsupported diagram type, PDF page count out of
    scope, minimum-legal geometry exceeds plate size)
```

Note: `review_status` lives per-region, while `status` lives per-job. A job only
reaches `exported` once every non-rejected region has been explicitly approved —
partial/silent export of un-reviewed regions should not be possible.
