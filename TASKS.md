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

**Phase 1 is done when:** uploading a 1-3 page test PDF produces correct region rows
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

Verification evidence and repeatable commands: `docs/text-processing-verification.md`.

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

Verification: `docs/table-processing-verification.md`. Checked against ruled/aligned fixtures
and explicit malformed examples. Unstyled multi-row headers remain a documented
first-row-assumption limitation requiring human review; this is not a claim of
universal table detection. Image routing now connects to Phase 4 below. Physical
conformance is not established by braille cell-layout checks.

**Phase 3 is done when:** a simple rectangular table from your test PDF produces
correctly formatted braille table output, and an intentionally-malformed test table
(e.g. merged cells) is correctly rejected rather than silently mishandled.

---

## Phase 4 — Diagram data extraction

Goal: Stage 3c Steps 1-2 from `docs/pipeline.md` — data only, no geometry yet.

- [x] Diagram type classification: bar chart / single-series line graph / unsupported
      (see exclusion list in `docs/bana-standards.md` §9)
- [x] Unsupported types fail with a clear message here — do not proceed to geometry
- [x] Gemini Call Type B: structured data extraction (chart type, data points, axis
      labels, series label) — verify output contains NO mm values, NO coordinates,
      NO geometry, per `AGENTS.md` §4
- [x] Validate extraction response with Zod; on failure retry up to
      `MAX_GEMINI_VALIDATION_RETRIES` (3) times before failing that region only (not
      the whole job) with a clear message
- [x] Store result in `regions.extracted_data` for diagram regions

Verified 2026-09-17: 13 Phase 4 tests and all 40 earlier-phase tests passed;
lint, strict TypeScript and production build passed. Real Call B extracted exact
labels/values from both generated bar and line charts, visually checked against
their crops. The line check needed one later manual attempt after a service error;
3 live requests total, no automatic service retries. Supabase read-back matched
the line result with pending review and null geometry; synthetic rows were removed.
Commands live in `docs/testing-scope.md`, evidence in `docs/compliance-report.md`.

**Phase 4 is done when:** a bar chart and a line graph from your test PDF each
produce correct structured data (right values, right labels) — verify by eye against
the source diagram.

---

## Classification reliability follow-up (20
26-09-17)

- [x] Retry only Call A HTTP 429/503 with bounded 30/90-second backoff, disabling
      SDK retries and preserving the separate Zod validation budget.
- [x] Keep pages sequential and preserve successful pages; add failed-page-only
      retry with temporary PDF sessions, cooldown, caps and concurrent-request guard.
- [x] Reuse prepared page results and make region persistence idempotent, with clear
      per-page errors and recovery of an all-failed job to `processing`.
- [x] Verify 429/503 recovery/exhaustion, non-transient errors, success preservation,
      sequential processing and failed-page retry with quota-free regression tests.

18 recovery tests and all 53 Phase 1-4 tests passed, plus lint, strict TypeScript
and the production build (both upload and retry routes).
No live model traffic was used; deployment/session limitations are documented in
`README.md` and `docs/testing-scope.md`. Phase 5 remains untouched.

---

## Phase 5 — Deterministic geometry generation + BANA validation

Goal: Stage 3c Steps 3-4 from `docs/pipeline.md`. This is the highest-risk phase —
go slowly and re-check against `docs/bana-standards.md` constantly.

- [x] Dynamic scale computation: given extracted data + BANA minimums (§3, §5, §6) +
      max plate size (§1 / env config), compute the graphic element scale
      deterministically
- [x] Explicit failure path: if minimum-legal layout exceeds max plate size, fail
      with a clear message — do not shrink below BANA minimums (`docs/bana-standards.md`
      §10)
- [x] Bar chart geometry: bars at correct width/height/spacing per §5; deterministic
      single-series texture and braille category labels, never color-only distinction
- [x] Line graph geometry: single-series only, correct line height hierarchy (data >
      axis > grid, §3), point-symbol shapes at correct size (§6)
- [x] Braille label geometry: constant dimensions, never scaled with the graphic
      (§10) — this is the most likely place to introduce a silent bug, double-check it
- [x] Deterministic validator: checks every generated element against
      `docs/bana-standards.md` spacing/size rules; a design with violations does not
      proceed to preview
- [x] Element addressing: approved stable, deterministic, human-readable IDs
      documented in `docs/data-model.md` and retained in geometry/mesh addressing
- [x] Store validated geometry in `regions.geometry`

**Phase 5 is done when:** a bar chart and a line graph from your test PDF each
produce geometry that passes validation with zero violations, and a manually
constructed "impossible" test case (e.g. 40 bars) correctly fails with a clear
message instead of producing out-of-spec geometry.

Verified 2026-09-17: 26 Phase 5 tests and 75 regression tests passed, alongside
lint, strict TypeScript and the production build. Zero-Gemini fixture geometry
passed with no violations; 40 bars failed with `GEOMETRY_TOO_DENSE`. Supabase
read-back matched two geometry rows, repeat insertion was idempotent, readiness
was confirmed, and synthetic rows were removed. Top-view artifacts were inspected.
Physical print/slicer testing and expert tactile review remain unverified; no
Phase 6 UI or export implementation was added.

---

## Phase 6 — Preview UI

Goal: Stage 4 from `docs/pipeline.md`.

- [x] Render the validated three.js mesh client-side
- [x] Side-by-side layout: generated mesh + original source region image
- [x] Confirm the preview renders the exact same mesh object that will be used for
      export later (no separate/duplicate geometry generation for preview — see
      `AGENTS.md` §7)
- [x] Basic camera controls (orbit/rotate) so raised-height detail is visible from
      multiple angles

**Phase 6 is done when:** a reviewer can look at the 3D preview next to the source
diagram and visually confirm whether it's correct, without needing to read raw data.

Verified 2026-09-18: 5 Phase 6 tests and all 95 regression tests from Phases 1–5 passed;
lint (0 errors, 0 warnings), strict TypeScript (`npx tsc --noEmit`), and Next.js production
build (`npm run build`) passed cleanly. Review workspace renders side-by-side layout with
the original source crop (served via temporary in-memory route) and interactive Three.js
mesh constructed directly from validated geometry. Mesh identity is preserved across
preview and export handles. Camera controls provide top-down and orbit controls with
keyboard-accessible labels.
Remaining limitations: Browser preview verification does not prove physical 3D print
readability, slicer tolerance, or expert tactile reader approval. Temporary source crops
are held in-memory (bounded LRU, 15-minute TTL) and return HTTP 410 when expired; they
are not persisted in Supabase. Approval, editing, and export actions remain reserved for
Phases 7 and 8.

---

## Phase 7 — Review + edit-prompt

Goal: Stage 5 and 5a from `docs/pipeline.md`.

- [x] Review actions per region: approve / edit-prompt / reject, updating
      `regions.review_status`
- [x] Edit-prompt input: plain-English instruction + editable title IDs/current text
      sent to the edit agent; physical coordinates and non-title geometry are excluded
- [x] Edit agent constrained to schema-checked title relabeling only; unsupported
      operations cannot emit raw geometry or regenerate a chart (`AGENTS.md` §8)
- [x] Every edit result re-runs the full Phase 5 validator before returning to
      preview — confirm this actually happens, don't trust an edit as pre-validated
- [ ] (Optional) log edits to the `edits` table if you added it in Phase 0

**Phase 7 is done when:** a deliberately-wrong test diagram can be corrected via a
plain-English edit prompt, re-validates cleanly, and the fix is visible in the
updated preview.

---

## Phase 8 — Export

Goal: Stage 6 and 7 from `docs/pipeline.md`.

- [x] STL export for each approved diagram from the same validated geometry state
      and deterministic mesh-generation path used by the preview
- [x] Braille text export for approved text and table regions, in page and region
      order (verified by the reviewer)
- [x] Rejected regions excluded entirely — only approved regions enter individual
      downloads and the ZIP package; no rejected-region placeholder is exported
- [x] Combined package (ZIP) assembled in memory and served as a browser download
- [x] Export remains a download action; no `exported` job-status transition is
      required for v1. Only approved regions are included, so pending regions are
      never silently included in an export.

**Phase 8 is done when:** approving all regions in a test job produces one downloadable
package containing correct braille text file(s) and correct STL file(s), and nothing
in that package traces back to an un-reviewed or rejected region.

---

## Phase 9 — End-to-end QA

Goal: confirm the "done" bar in `docs/testing-scope.md` is actually met.

- [ ] Run a full 1-3 page test PDF (text + one diagram + one table) through the
      entire pipeline with no manual DB/backend intervention
- [ ] logging is in place for both Gemini call types (per
      `docs/testing-scope.md`, "Cost/token scope") and note actual per-document cost
- [ ] Confirm no Gemini call exists anywhere outside Stage 2 classification and
      Stage 3c diagram data Confirm token usage extraction (`docs/pipeline.md`, "Cost/token discipline")
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
