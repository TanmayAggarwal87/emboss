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

- Input: uploaded PDF (2-3 pages, v1 scope)
- Tool: MuPDF
- Action: render each page to an image (for region classification and diagram crops)
  AND keep the PDF's real text layer accessible for direct extraction later — do not
  discard it just because you've rasterized the page.
- Check for text layer presence here: if a page has no extractable text layer at all
  (i.e. it's a scanned image), flag it for the OCR fallback path (see Stage 3a note).
  This should be rare in the 2-3 page test scope but must not silently produce empty
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

- First, determine: is this a real text-based table (extractable via MuPDF) or an
  embedded image of a table? If the region's content isn't extractable as structured
  text via MuPDF, treat it as a diagram region instead and route to 3c.
- If it's a real text table: extract rows/columns via MuPDF, apply BANA table rules
  from `docs/bana-standards.md` §8 (alignment, 3-cell spacing, guide dots instead of
  grid lines, hyphen-fill for empty cells).
- Detect and reject (or route elsewhere) unsupported table shapes: merged cells,
  multi-row headers, stem-and-leaf plots, perimeter-less Punnett-square-style tables.
  See `docs/bana-standards.md` §8 for the exact exclusion list.
- Output: braille-formatted table text, following BANA structural rules, no LLM
  involvement for a genuine text table.

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

## Stage 4 — Preview

- Renders the generated mesh (three.js, client-side) alongside the original source
  region image, so a sighted reviewer can visually compare them.
- The preview must use the **exact same mesh object** that will later be exported to
  STL — do not regenerate geometry separately for preview vs. export.

## Stage 5 — Human review

- Reviewer chooses: approve, request an edit, or reject.
- **Approve** → proceeds to Stage 6 for this region.
- **Reject** → this region is dropped from the output package (does not block other
  regions in the same document).
- **Edit-prompt** → see Stage 5a.

## Stage 5a — Edit-prompt

- Input: plain-English instruction + current geometry state (with element IDs)
- The edit agent may only emit schema-checked operations against real elements
  (move/resize/relabel by ID) — never raw geometry, never a full regeneration.
  See AGENTS.md §8.
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

The only two points in this entire pipeline that should ever call Gemini are Stage 2
(classification, fixed cost per page regardless of text density) and Stage 3c Step 2
(diagram data extraction, cost proportional to diagram content only). If you find a
Gemini call anywhere else in the pipeline — reading plain text, reading a real text
table, computing geometry, deciding spacing — that call should not exist. Route that
work to MuPDF, liblouis, or deterministic code instead.
