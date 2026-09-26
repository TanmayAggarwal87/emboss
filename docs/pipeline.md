# Pipeline — Emboss

This file describes the technical flow stage by stage, including what data crosses
each boundary. Read `AGENTS.md` first for the rules this pipeline must obey — this
file is the "how," that file is the "what's not negotiable."

---

## Overview

```
PDF upload
  → 1. Page raster (MuPDF)
  → 2. Region classification (Gemini — Call Type A)
  → 3. Route by region type
        3a. text    → MuPDF text-layer extraction → liblouis → braille text
        3b. table   → MuPDF text extraction (or → 3c if table is an image) → BANA
                       table rules → braille table
        3c. diagram → Gemini structured-data extraction (Call Type B)
                       → deterministic geometry generation (three.js)
                       → deterministic BANA validation
  → 4. Preview (3D mesh + original source image side by side)
  → 5. Human review: approve / edit-prompt / reject
        5a. edit-prompt → scoped schema-checked operation → re-run BANA validation
                          → back to step 4
  → 6. Export (STL for diagrams, braille text for text/tables)
  → 7. Combined output package
```

---

## Stage 1 — Page raster

- Input: uploaded PDF (1-3 pages, v1 scope)
- Tool: MuPDF
- Action: render each page to an image (for region classification and diagram crops)
  AND keep the PDF's real text layer accessible for direct extraction later — do not
  discard it just because you've rasterized the page.
- Check for text layer presence here: if a page has no extractable text layer at all
  (i.e. it's a scanned image), flag it for the OCR fallback path (see Stage 3a note).
  This should be rare in the 1-3 page test scope but must not silently produce empty
  output.
- Output per page: `{ page_number, raster_image, has_text_layer: boolean }`

## Stage 2 — Region classification (Gemini Call Type A)

- Input: one page raster image
- Output: array of regions, each `{ region_id, type: "text"|"diagram"|"table",
  bounding_box: {x, y, width, height} }`
- **This call must never return transcribed text content.** If you find yourself
  parsing body text out of a classification response, something is wrong — that data
  should not exist in this response at all. See AGENTS.md §4.
- Validate this response with Zod before using it. A malformed or out-of-bounds
  bounding box should fail loudly, not get silently clamped or guessed.
- If validation fails, retry the call (up to 3 total attempts — see AGENTS.md §4 /
  `.env.example` `MAX_GEMINI_VALIDATION_RETRIES`). After 3 failed attempts, fail that
  page's classification with a clear message rather than proceeding with invalid data.

### Classification recovery (Stage 2 follow-up)

Call A has a separate transport budget: only HTTP 429/503 retry, at 30 then 90
seconds, with at most two extra requests **shared across** all Zod attempts for
that page. SDK retries are disabled and each HTTP attempt times out at 60 seconds.
Other service errors fail immediately; schema failures still use the configured
validation-attempt limit. With three validation attempts, there are at most five
HTTP requests per page per processing run, not three nested sets of three.

Pages remain sequential and completed page results are preserved. Upload responses
include failed-page `error_code`/`retryable` and `retry` metadata. Send
`POST /api/jobs/<job_id>/retry` with `{"pages":[2]}` after `available_after` to resume
only selected failed pages. A classified page is never reprocessed by this endpoint,
even if one of its downstream region results failed. Call B behavior is unchanged.

PDF bytes, validated classifications and completed region checkpoints live in a
bounded process-local session; full page rasters are not retained. Phase 6 retains
bounded source crops separately for preview (Stage 4 below). The session expires after
15 minutes; completed/non-retryable jobs release bytes early. At most 20 sessions
and 64 MiB of raw PDF bytes are retained per process (metadata is additional).
Capacity exhaustion rejects new uploads before creating a job or calling Gemini.
Concurrent retries of a job return 409; retries have a one-minute cooldown and a
three-request per-job cap, sharing the five-request IP guard with uploads.

Both endpoints declare a 600-second host allowance. A 180-second cooperative
deadline cancels Call A/backoff and prevents starting further pages/regions; an
already-running downstream region may finish before cleanup. There is no queue.
Deploy on one long-lived Node process or guarantee same-process routing. Session
loss/restart/expiry returns 410 without deleting persisted successes. Platform
request limits must support this synchronous flow; session memory is not shared
between independently deployed serverless functions.

## Stage 3a — Text regions

- Input: a text region's bounding box + the source page's real text layer
- Tool: MuPDF text extraction, scoped to the bounding box
- If `has_text_layer` is false for this page (scanned PDF fallback): this is the only
  place OCR is acceptable, and it should still go through a text-reading path, not a
  general Gemini vision call reused from Stage 2/3c. Keep this fallback clearly
  separated in code from the normal path.
- Output: plain text string for the region
- Then: pass directly to liblouis for Grade 1/2 braille translation. No LLM call
  anywhere in this stage under normal (text-layer-present) conditions.

Phase 2 implementation details:
- Region boxes reference the centered 1000x1000 page raster. Rendering and extraction
  share one transform; extraction includes characters whose centers lie inside both
  axes of the box, accounting for rotation, page padding, and CropBox offsets.
- English UEB uses liblouis's `en-ueb-g1.ctb` / `en-ueb-g2.ctb` tables and Unicode
  braille display table. `BRAILLE_GRADE` defaults to 2; set it to 1 for uncontracted
  braille. This stage does not paginate or apply physical export layout.
- Scanned pages use a separate local Tesseract OCR path. It rerenders only the region
  at up to 2000x2000 pixels and loads bundled English language data, with no Gemini
  request or runtime language download. Each OCR operation is awaited in the same
  upload request; worker threads are computation isolation, not a background queue.
- OCR times out after 60 seconds per region. Empty results and confidence below 60
  fail explicitly. This threshold is a heuristic, not proof of accuracy; every OCR
  success carries a human-review warning. The worker and its nested OCR worker are
  terminated on completion/failure/timeout, including initialization failure.
- A page with a real text layer never silently falls back to OCR when an individual
  box extracts no text. Such regions fail with a clear message. Mixed pages whose
  text is partly scanned need clearer input or future region-specific OCR support.
- Results and per-region failures use the text contract in `docs/data-model.md`.
  Failed regions do not prevent processing the remaining regions/pages.

## Stage 3b — Table regions

- First, inspect the region using MuPDF: real text table or embedded image table?
  Image content inside the box routes it to 3c, even on a page that also has real
  text. An ambiguous real-text structure fails locally; extraction failure alone
  is not permission to send table text to an AI fallback.
- If it's a real text table: extract rows/columns via MuPDF, apply BANA table rules
  from `docs/bana-standards.md` §8 (alignment, 3-cell spacing, guide dots instead of
  grid lines, hyphen-fill for empty cells).
- Detect and reject (or route elsewhere) unsupported table shapes: merged cells,
  multi-row headers, stem-and-leaf plots, perimeter-less Punnett-square-style tables.
  See `docs/bana-standards.md` §8 for the exact exclusion list.
- Output: braille-formatted table text, following BANA structural rules, no LLM
  involvement for a genuine text table.

Phase 3 implementation details:

- Character bounds, font evidence, images, and vector rules use the same raster
  transform as classification. Both stroked rules and thin filled rectangles are
  recognized. Complete rectangular grids support empty cells; unruled tables must
  have consistent columns with clear shared gutters and no missing cells.
- Incomplete grids, merged-cell evidence, clipped/rotated text, multi-line headers,
  additional all-bold header-like rows, and recognized stem-and-leaf/Punnett shapes
  fail per region. Arbitrary unstyled multi-row headers cannot be identified with
  certainty: every result warns that the first row is assumed to be the header and
  requires human verification. Sparse/ambiguous unruled tables are rejected.
- liblouis translates cells with the existing UEB grade setting. Constants in
  `src/lib/table-processing/table-rules.ts` reference `docs/bana-standards.md` §§1/8: 3 blank
  cells between columns, 1 blank line after headers, dot-5 guides with 1 intervening
  blank in spare text-column padding, and centered two-hyphen empty-cell indicators.
  Numeric columns align right; text columns align left. PDF grid lines are not output.
- Output sections fit 40 cells by 25 lines. Aligned sections repeat their header;
  wide tables use a vertical list with repeated labels. An unbreakable value over
  40 cells or a vertical row group over 25 lines fails instead of being truncated.
  These are braille text layout limits, not geometry or final export pagination.
- Tables and failures persist using `docs/data-model.md`. Image tables are saved as
  diagram regions and now pass through Phase 4; actual image tables fail the narrow
  chart-type check. This handoff does not enable table-data extraction by Gemini.
  This stage invokes neither Gemini nor OCR and does not implement review/export.

## Stage 3c — Diagram regions (Gemini Call Type B)

- Input: cropped image of one region already classified as `diagram`
- Step 1 — classify diagram type: bar chart, single-series line graph, or
  unsupported (see `docs/bana-standards.md` §9 for the full exclusion list). If
  unsupported, stop here and surface a clear message — do not attempt best-effort
  geometry.
- Step 2 — Gemini extracts **structured data only**: chart type, data points, axis
  labels, series/legend label if present. Validate with Zod. This output must contain
  no mm values, no coordinates, no geometry — data only. Same retry policy as Stage 2:
  up to 3 total attempts on validation failure, then fail that region with a clear
  message (does not fail the rest of the job).
- Step 3 — deterministic geometry generation (three.js):
  - Compute dynamic scale for graphic elements against BANA minimums (see
    `docs/bana-standards.md` §10), capped at max plate size.
  - Build bars/line/points/axis/grid using the height and spacing constants from
    `docs/bana-standards.md` §3, §5, §6.
  - Braille label geometry uses constant (never scaled) dimensions.
  - If minimum-legal layout still exceeds max plate size: fail explicitly with a
    clear message, do not shrink below BANA minimums.
- Step 4 — deterministic BANA validation: check every generated element against the
  spacing/size rules in `docs/bana-standards.md` before this geometry is allowed into
  preview. A design with violations does not proceed to Stage 4.
- Output: a three.js mesh/scene graph representing the tactile diagram, with
  addressable elements (see `docs/data-model.md` for ID scheme once finalized).

Phase 4 implements **Steps 1-2 only**:

- MuPDF rerenders just the classified box at twice classification resolution,
  bounded to 2000x2000 pixels, using the shared transform. Call B sees that single
  crop, never the full page. Image-table rerouting uses this same path.
- `docs/prompts.md` supplies the exact Call B system prompt; `GEMINI_MODEL` selects
  the model. Native structured output and strict nested Zod validation enforce the
  documented shape. Bar/line classification and content extraction occur in one
  Call B, separate from page classification (Call A).
- Only JSON/schema validation failures retry, up to the configured total attempts.
  Unsupported and nullable results do not retry. Call B disables SDK HTTP retries
  and uses a 60-second request timeout; 429/503/timeout, blocked/incomplete responses,
  and validation exhaustion produce clear per-region failures. Token counts and
  numeric service status are logged without raw document content or credentials.
- Valid data and explicit errors persist using `docs/data-model.md`. Null values
  stay null and require data review before future geometry generation. Jobs remain
  `processing`, regions remain `pending`, and geometry stays null. Steps 3-4 and
  the review/export stages remain later work.

## Phase 5 — Deterministic geometry processing

After successful diagram extraction, the Phase 5 processor lays out a
version-1 `GeometryState` in millimetres and runs deterministic accessibility and
manufacturing validation. A successful result is persisted as
`regions.geometry`, with `geometry_processing: { status: "validated" }` in
`extracted_data` and warnings alongside the extraction result; a region may
fail geometry while retaining its extracted Phase 4 data and a clear error. The
processor accepts only aligned numeric/categorical independent-axis data and the
supported vertical/horizontal bar or single-series line contracts. Null values,
non-monotonic numeric positions, overlong labels, and dense charts fail rather than
being guessed, compressed, or braille-scaled.

The default FDM profile is a 180 × 180 mm envelope including margins with a 2 mm
base. Braille dimensions are immutable NLS dimensions; accessibility constraints
and manufacturing constraints are reported separately, and software validation is
not physical certification. Geometry is an additive Three.js group of closed
solids, including the plate, relief, texture, and braille dots. No UI or export
feature is implied by this processing stage. The production upload/retry runtime
always supplies the processor; earlier-phase isolated tests may omit it.

## Stage 4 — Preview (Side-by-side Review UI)

The upload and retry pipelines generate high-resolution PNG source crops using MuPDF
while the original document handle is active. These crops are:
- **Generated locally by MuPDF**: Scoped precisely to the classified region bounding box.
- **Never sent to Gemini again**: Used exclusively for human review verification in the
  client UI. Sighted reviewers compare the tactile 3D relief or braille formatting
  directly against what was originally printed in the document.
- **Session-local delivery**: Upload/retry responses include PNG data URLs that the
  browser displays directly, without another server request or model call. Inline
  crops share a 2 MiB character budget per response; oversized crops receive a clear
  preview-only error. Browser copies live only in app memory until reset or reload.
  A bounded server cache (32 MB, 128 entries, 15-minute TTL) remains for legacy URLs.
  Crops are not stored in Supabase tables, filesystems, or cloud buckets.
- **HTTP 410 Gone on expiry**: The dedicated endpoint (`/api/jobs/[jobId]/regions/[regionId]/source`)
  validates job/region UUIDs and emits `Cache-Control: private, no-store`.
  If the TTL expires, the process restarts, or another serverless replica serves the
  request, the endpoint responds with HTTP 410 (Gone). Saved database records and validated
  geometry remain intact; reviewers can still inspect the geometry and compare with their
  own source document. The current UI prefers response-delivered crops, so a cache
  miss on this legacy endpoint does not prevent current-session preview display.

The client preview renders:
- **Exact mesh object reuse**: The viewer constructs the 3D model using `createPreviewMesh(geometry)`,
  retaining the exact same `THREE.Group` instance intended for Phase 8 STL export (`AGENTS.md` §7).
  There is zero separate or duplicate geometry generation between preview and export.
- **Interactive tactile inspection**: Includes orbit controls and keyboard-accessible buttons
  for Top-Down view, Reset, Zoom in/out, and 3D rotation, enabling visual verification of
  elevation hierarchies and spacing minimums.
- **Failure isolation**: Invalid geometry or BANA violations block 3D mesh display with an
  explicit alert banner. WebGL context loss or absence surfaces a clear, actionable message.
- Region approval is persisted independently. Approving a region keeps the reviewer in
  the review workspace so other regions can be reviewed and approved separately.
- Region exclusion is also persisted independently; excluded regions are omitted from
  exports and do not prevent other regions from being approved.
- Export is available once at least one region is approved. Each approved region can be
  downloaded individually or included with the other approved files in one ZIP package.
- Edit-prompt remains limited to the supported operations in the versioned Call C
  contract; unsupported changes must be surfaced without mutating geometry.

## Stage 5 — Human review

- Reviewer chooses: approve, request an edit, or reject.
- **Approve** → proceeds to Stage 6 for this region.
- **Reject** → this region is dropped from the output package (does not block other
  regions in the same document).
- **Edit-prompt** → see Stage 5a.

## Stage 5a — Edit-prompt

- Input: plain-English instruction plus only editable axis/series title IDs and
  their current text; physical coordinates and other geometry are not sent to Gemini.
- Call Type C may relabel `label-x-title`, `label-y-title`, or `legend-0` only.
  Changing data/category/tick labels, moving, resizing, deleting, or creating
  elements is unsupported. Replacement wording must occur verbatim in the human
  instruction.
- Deterministic code translates the replacement with liblouis, recomputes its fixed
  braille footprint, and reruns the full Phase 5 validator before saving it as
  pending review. The original extracted source data is never changed.
- After an edit operation is applied, the result must be re-run through the full
  Stage 3c Step 4 validation before returning to Stage 4 preview. An edited design is
  never treated as pre-validated just because a human requested the change.

## Stage 6 — Export

- Diagram regions (approved) → STL file, generated from the same mesh used in preview
- Text and table regions (approved) → braille text file(s), page-ordered
- Rejected regions are excluded entirely — do not export placeholder/empty content
  for them.

## Stage 7 — Combined output package

- A single downloadable package (e.g. zip) containing:
  - Braille text file(s) for text/table regions, in page order
  - STL file(s) for diagram regions, one per approved diagram
- No persistent storage of this package after the session — see AGENTS.md §5 /
  §9 (no file storage bucket in v1; process in memory/tmp per session).

---

## Cost/token discipline (ties to AGENTS.md §4)

The only automatic Gemini calls while processing an uploaded document are Stage 2
(classification, one page image per call) and Stage 3c Step 2 (structured extraction
of a diagram crop). Stage 5a has a separate, optional Call C only when a human asks
to relabel an eligible title. No Gemini call belongs in plain-text or real-table
extraction, braille translation, geometry generation, physical validation, preview,
or export. Route those operations to MuPDF, liblouis, or deterministic code instead.
