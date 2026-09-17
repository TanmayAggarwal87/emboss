# TASKS.md — Emboss build plan

Single source of truth for build progress. Work phases in order — later phases
depend on earlier ones being real and working, not stubbed. Check off `[x]` only
when a task is actually done and verified, not when code is written but untested.

Before starting any phase: re-read `AGENTS.md` in full. Before touching geometry or
BANA numbers: re-read `docs/bana-standards.md`. Do not skip ahead to a later phase
because it seems more interesting — an untested earlier stage breaks everything built
on top of it.

---

## Phase 0 — Project scaffolding

Goal: a running Next.js app connected to Supabase, with no pipeline logic yet.

- [x] Init Next.js app (App Router)
- [x] Connect Supabase project (env vars per `.env.example`)
- [x] Create `jobs` and `regions` tables per `docs/data-model.md` (skip `edits` table
      for now — optional, add later if wanted)
- [x] Confirm a route handler can read/write a row in `jobs` end to end (trivial
      test route, delete once confirmed)
- [x] Install and confirm imports resolve for: MuPDF bindings, liblouis bindings,
      three.js, Zod, Gemini SDK/client
- [x] Do NOT install Drizzle yet (per AGENTS.md §9 — only add if the plain Supabase
      client genuinely becomes insufficient)

**Phase 0 is done when:** the app runs locally, a job row can be created and read
back from the DB, and every core dependency imports without error.

---

## Phase 1 — Upload, raster, and region classification

Goal: Stage 1 and Stage 2 from `docs/pipeline.md` working end to end.

- [x] Upload route: accepts a PDF, enforces `MAX_PDF_PAGES` (reject with clear
      message if exceeded — see `docs/testing-scope.md`)
- [x] Enforce `MAX_UPLOAD_SIZE_MB` (7 MB) before any processing starts — reject
      over-cap files immediately, don't let them reach MuPDF/Gemini
- [x] Enforce `RATE_LIMIT_UPLOADS_PER_IP` (5) as a basic abuse guard on the upload
      route — see `AGENTS.md` §5
- [x] Create a `jobs` row on upload, status `processing`
- [x] Page raster via MuPDF — one image per page
- [x] Confirm text-layer presence per page (`has_text_layer` flag) — flag pages with
      no text layer for the OCR fallback path, don't silently proceed as if they have
      one
- [x] Gemini Call Type A: region classification per page — bounding box + type label
      ONLY (text / diagram / table). See `AGENTS.md` §4 — verify the response
      contains no transcribed text content
- [x] Validate classification response with Zod before persisting; on failure retry
      up to `MAX_GEMINI_VALIDATION_RETRIES` (3) times before failing that page with a
      clear message (see `AGENTS.md` §4)
- [x] Create one `regions` row per detected region, `review_status: pending`
- [ ] Job status moves toward `ready_for_review` once all pages are classified (full
      transition happens after Phase 2-4 also complete per region)

**Phase 1 is done when:** uploading a 2-3 page test PDF produces correct region rows
(right count, right type, sane bounding boxes) — verify by eye against the source PDF
before moving on.

---

## Phase 2 — Text region pipeline

Goal: Stage 3a from `docs/pipeline.md`.

- [x] MuPDF text extraction scoped to a text region's bounding box
- [x] liblouis integration: plain text → Grade 1/2 braille
- [x] Store result in `regions.extracted_data` for text regions
- [x] OCR fallback path implemented separately for the no-text-layer case (keep this
      code path clearly separate from the normal path per `docs/pipeline.md` Stage 3a)
- [x] Confirm zero Gemini calls happen anywhere in this phase under normal conditions

Verification evidence and repeatable commands: `docs/phase2-verification.md`.

**Phase 2 is done when:** a text region from your test PDF produces correct braille
output, verified against a known-correct braille reference for the same text if
possible.

---

## Phase 3 — Table region pipeline

Goal: Stage 3b from `docs/pipeline.md`.

- [x] Detect real text table vs. embedded image table; route image tables to Phase 4
      (diagram pipeline) instead
- [x] MuPDF extraction of rows/columns for real text tables
- [x] Apply BANA table rules from `docs/bana-standards.md` §8: alignment, 3-cell
      spacing, guide-dot railing instead of grid lines, hyphen-fill for empty cells
- [x] Detect and reject unsupported table shapes (merged cells, multi-row headers,
      stem-and-leaf, perimeter-less Punnett-style) per the exclusion list in
      `docs/bana-standards.md` §8
- [x] Store result in `regions.extracted_data` for table regions

Verification: `docs/phase3-verification.md`. Checked against ruled/aligned fixtures
and explicit malformed examples. Unstyled multi-row headers remain a documented
first-row-assumption limitation requiring human review; this is not a claim of
universal table detection. Image routing leaves Phase 4 work pending. Physical
conformance is not established by braille cell-layout checks.

**Phase 3 is done when:** a simple rectangular table from your test PDF produces
correctly formatted braille table output, and an intentionally-malformed test table
(e.g. merged cells) is correctly rejected rather than silently mishandled.

---

## Phase 4 — Diagram data extraction

Goal: Stage 3c Steps 1-2 from `docs/pipeline.md` — data only, no geometry yet.

- [ ] Diagram type classification: bar chart / single-series line graph / unsupported
      (see exclusion list in `docs/bana-standards.md` §9)
- [ ] Unsupported types fail with a clear message here — do not proceed to geometry
- [ ] Gemini Call Type B: structured data extraction (chart type, data points, axis
      labels, series label) — verify output contains NO mm values, NO coordinates,
      NO geometry, per `AGENTS.md` §4
- [ ] Validate extraction response with Zod; on failure retry up to
      `MAX_GEMINI_VALIDATION_RETRIES` (3) times before failing that region only (not
      the whole job) with a clear message
- [ ] Store result in `regions.extracted_data` for diagram regions

**Phase 4 is done when:** a bar chart and a line graph from your test PDF each
produce correct structured data (right values, right labels) — verify by eye against
the source diagram.

---

## Phase 5 — Deterministic geometry generation + BANA validation

Goal: Stage 3c Steps 3-4 from `docs/pipeline.md`. This is the highest-risk phase —
go slowly and re-check against `docs/bana-standards.md` constantly.

- [ ] Dynamic scale computation: given extracted data + BANA minimums (§3, §5, §6) +
      max plate size (§1 / env config), compute the graphic element scale
      deterministically
- [ ] Explicit failure path: if minimum-legal layout exceeds max plate size, fail
      with a clear message — do not shrink below BANA minimums (`docs/bana-standards.md`
      §10)
- [ ] Bar chart geometry: bars at correct width/height/spacing per §5, textured (not
      color-coded) category differentiation
- [ ] Line graph geometry: single-series only, correct line height hierarchy (data >
      axis > grid, §3), point-symbol shapes at correct size (§6)
- [ ] Braille label geometry: constant dimensions, never scaled with the graphic
      (§10) — this is the most likely place to introduce a silent bug, double-check it
- [ ] Deterministic validator: checks every generated element against
      `docs/bana-standards.md` spacing/size rules; a design with violations does not
      proceed to preview
- [ ] Element addressing: assign the stable ID scheme once defined (see
      `docs/data-model.md`, "Element ID scheme" — confirm this is settled before
      building this checklist item; if still undefined, stop and settle it first)
- [ ] Store validated geometry in `regions.geometry`

**Phase 5 is done when:** a bar chart and a line graph from your test PDF each
produce geometry that passes validation with zero violations, and a manually
constructed "impossible" test case (e.g. 40 bars) correctly fails with a clear
message instead of producing out-of-spec geometry.

---

## Phase 6 — Preview UI

Goal: Stage 4 from `docs/pipeline.md`.

- [ ] Render the validated three.js mesh client-side
- [ ] Side-by-side layout: generated mesh + original source region image
- [ ] Confirm the preview renders the exact same mesh object that will be used for
      export later (no separate/duplicate geometry generation for preview — see
      `AGENTS.md` §7)
- [ ] Basic camera controls (orbit/rotate) so raised-height detail is visible from
      multiple angles

**Phase 6 is done when:** a reviewer can look at the 3D preview next to the source
diagram and visually confirm whether it's correct, without needing to read raw data.

---

## Phase 7 — Review + edit-prompt

Goal: Stage 5 and 5a from `docs/pipeline.md`.

- [ ] Review actions per region: approve / edit-prompt / reject, updating
      `regions.review_status`
- [ ] Edit-prompt input: plain-English instruction + current geometry state (with
      element IDs) sent to the edit agent
- [ ] Edit agent constrained to schema-checked operations against real elements only
      (move/resize/relabel by ID) — verify it cannot emit raw geometry or a full
      regeneration (`AGENTS.md` §8)
- [ ] Every edit result re-runs the full Phase 5 validator before returning to
      preview — confirm this actually happens, don't trust an edit as pre-validated
- [ ] (Optional) log edits to the `edits` table if you added it in Phase 0

**Phase 7 is done when:** a deliberately-wrong test diagram can be corrected via a
plain-English edit prompt, re-validates cleanly, and the fix is visible in the
updated preview.

---

## Phase 8 — Export

Goal: Stage 6 and 7 from `docs/pipeline.md`.

- [ ] STL export from the same mesh object used in preview, for each approved
      diagram region
- [ ] Braille text export for approved text and table regions, page-ordered
- [ ] Rejected regions excluded entirely — confirm no placeholder/empty content is
      exported for them
- [ ] Combined package (e.g. zip) assembled and served for download
- [ ] Job status moves to `exported` only once every non-rejected region is
      `approved` (per `docs/data-model.md` lifecycle notes) — confirm partial/silent
      export of un-reviewed regions is not possible

**Phase 8 is done when:** approving all regions in a test job produces one downloadable
package containing correct braille text file(s) and correct STL file(s), and nothing
in that package traces back to an un-reviewed or rejected region.

---

## Phase 9 — End-to-end QA

Goal: confirm the "done" bar in `docs/testing-scope.md` is actually met.

- [ ] Run a full 2-3 page test PDF (text + one diagram + one table) through the
      entire pipeline with no manual DB/backend intervention
- [ ] Confirm token usage logging is in place for both Gemini call types (per
      `docs/testing-scope.md`, "Cost/token scope") and note actual per-document cost
- [ ] Confirm no Gemini call exists anywhere outside Stage 2 classification and
      Stage 3c diagram data extraction (`docs/pipeline.md`, "Cost/token discipline")
- [ ] Run at least one intentionally out-of-scope input through the pipeline (e.g. an
      unsupported diagram type, an oversized table, a >3-page PDF) and confirm each
      fails with a clear, specific message rather than a crash or silent bad output
- [ ] Re-check `docs/testing-scope.md` "Explicitly not in v1 testing scope" — confirm
      none of those were accidentally built

**Phase 9 is done when:** the "What done looks like for v1 testing" section in
`docs/testing-scope.md` is true for a real test document, verified in one sitting.

---

## Deferred / not part of this checklist

- `docs/frontend.md` conventions (shadcn, layout, design) — apply once that doc
  exists; not blocking the phases above
- Auth, persistent history, file storage buckets — explicitly out of v1, see
  `AGENTS.md` §5
