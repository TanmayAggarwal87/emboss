# NOTES.md — Emboss

Living notes file. This is where mid-build discoveries, library quirks, and small
decisions go — things too minor for `AGENTS.md` but worth remembering so the same
question or mistake doesn't resurface in a later session.

This is different from the other docs:
- `AGENTS.md` / `docs/*.md` = decided **before** build starts, rules and architecture
- `TASKS.md` = **build progress**, checkboxes
- `docs/compliance-report.md` = **test evidence**, only real results
- `NOTES.md` (this file) = **running log during build** — append as you go, don't
  worry about polish

## How to use this file

- Add a dated entry whenever you hit something worth remembering: a library import
  quirk, a naming mismatch between docs and actual code, a small decision made
  in-session that isn't big enough to warrant editing `AGENTS.md`.
- If a note here turns out to matter a lot (e.g. it contradicts something in
  `AGENTS.md` or changes a locked decision), promote it: update the real doc and
  reference that you did so here, don't leave the correction stranded only in notes.
- Newest entries at the top.

---

## Entries

`[2026-09-17]` - Phase 5 uses the approved 180 × 180 mm generic FDM profile and 2 mm base, explicitly separate from BANA/NLS constraints in `docs/bana-standards.md`. Paper braille dimensions stay fixed. Call B now preserves bar orientation and categorical/numeric independent-axis values; old saved chart contracts require re-extraction rather than guessed defaults. Stable source-index element IDs are carried into Three.js groups; STL itself cannot retain semantic IDs.

`[2026-09-17]` - Geometry validation checks source proportions, fixed braille footprints, semantic IDs, spacing and profile bounds before persistence. Production processing also builds and bounds-checks the actual mesh. Additive solids intentionally overlap the base; stripe tops must be relative to the bar top, not the plate top. The mesh test caught that distinction. Slicer union behavior, physical readability and expert transcription approval still need later real-world verification. No packages or live Gemini calls were needed; 26 Phase 5 tests and 75 regression tests, lint, strict TypeScript and the production build passed.

`[2026-09-17]` - Reproduced Call A's transient-503 failure with a failing offline test before changing behavior. The installed Gemini SDK has its own HTTP retry layer; Call A now explicitly disables it and retries only numeric HTTP 429/503 with 30/90-second waits. Two extra transport requests are shared across the separate Zod attempt budget to prevent multiplication. No live Gemini requests or package installations were needed for this fix.

`[2026-09-17]` - Failed-page recovery uses a bounded 15-minute process-local PDF/checkpoint session, never Supabase Storage. Both route bundles share the runtime through `globalThis`, but different Node processes/serverless functions cannot share it; deploy accordingly or expect a clear 410 after session loss. Region UUIDv8 row keys derive from job/page/classification IDs, and conflict-ignore/read-back prevents duplicates or overwrites after an uncertain DB acknowledgement. These are not geometry element IDs. Page-level retry does not retry failed downstream regions on an already classified page.

`[2026-09-17]` - Phase 4 verification passed 13 new tests plus 40 regression tests, lint, strict TypeScript and production build. A generated two-page chart PDF supplied known labels/values: live Call B matched the bar chart immediately; the first line request failed with a service error. After a cooldown spent on build/docs, one line-only request matched exactly and passed Supabase read-back. Total live requests: 3. Both diagnostic jobs and their regions were removed. `npm run verify:phase4 -- --live --chart line --database` checks only the line fixture; omit `--live` for zero model traffic. Existing Phase 2/3 diagnostics remain quota-free through scoped fixture classification/injected diagram perception.

`[2026-09-17]` - Phase 4 adds Gemini Call B on MuPDF's existing bounded region raster, including diagrams rerouted from image tables. The canonical prompt text is still read from `docs/prompts.md`; native response schemas and strict nested Zod validation accept only bar/single-series-line data or the minimal unsupported result. Null values are retained with an explicit data-review flag, never inferred or turned into zero. The existing JSONB column stores diagram results/errors without a migration; geometry and review readiness remain later stages.

`[2026-09-17]` - Installed `@google/genai` 2.22.0 documents five HTTP attempts by default. Call B explicitly sets one HTTP attempt and a 60-second timeout, so provider failures do not create hidden retry traffic. Only JSON/schema failures use the configured application attempt limit. The SDK's separate native supported/unsupported schema branches are followed by strict Zod checks; [Google's structured-output documentation](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en) explains the API schema boundary. No new dependency was installed. Explicit Next output tracing now includes `docs/prompts.md` for deployed prompt loading.

`[2026-09-17]` - Phase 3 reads MuPDF character bounds and vector rules in classification-raster coordinates. The installed structured-text JS walker does not expose native table-grid blocks, so extraction uses actual glyph/rule evidence rather than assuming `table-hunt` supplies rows. Both stroked paths and thin filled rectangles occur as PDF rules; the [MuPDF Device API](https://mupdf.readthedocs.io/en/1.28.0/reference/javascript/types/Device.html) exposes these through different callbacks. Ambiguous real-text layouts fail locally; image evidence inside the region routes it to a pending diagram without Gemini/OCR. The first-row header assumption remains a human-review warning, not semantic certainty for unstyled headers.

`[2026-09-17]` - Table formatting constants reference `docs/bana-standards.md` §§1/8 and operate in fixed braille cells/lines, never inferred millimeters. Guide dots occupy spare column padding while three blank cells remain between columns. Wide tables use labeled vertical lists; unbreakable oversized cells fail. Source cells, translated cells, bounded output sections and errors persist in existing JSONB; no migration, package installation, or Storage bucket was needed. Phase 3's 12 tests and 28 earlier-phase tests passed; the zero-Gemini Supabase diagnostic matched three synthetic rows and removed them. See `docs/phase3-verification.md` and the scoped compliance evidence; this is not physical certification.

`[2026-09-17]` - Phase 2 implements text-region extraction using the same centered 1000x1000 raster transform as Phase 1, including PDF rotation and CropBox offsets. MuPDF `StructuredText.copy(start,end)` is a reading-order selection, not a rectangular crop, so region extraction uses character centers from the structured-text walker to avoid neighboring-column leakage. Text results retain source text, Unicode braille, grade/table/version and OCR provenance in `regions.extracted_data`; failures use a separate discriminated result and keep human review pending. No migration or Gemini call is needed for this phase.

`[2026-09-17]` - The installed liblouis 0.4.0 Easy API does not automatically mount tables despite its README, and its translation wrapper confuses byte capacities with widechar counts. Phase 2 explicitly mounts local tables and invokes `lou_translateString` with correctly sized buffers, checking consumed input before accepting output and freeing allocations in `finally`. The [liblouis API documentation](https://liblouis.io/documentation/liblouis/lou_005ftranslateString.html) confirms that a partial translation can return success when the output buffer fills. English UEB Grade 2 is the default; `BRAILLE_GRADE=1` selects Grade 1. The existing engine is 3.2.0, and its version is stored with results rather than implying a newer engine or specialist certification.

`[2026-09-17]` - Added Tesseract 7 and bundled English trained data for the separate scanned-page OCR path. Local assets and no cache writes follow the [Tesseract local-installation guidance](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md). The package's `createWorker` can leave initialization pending on a language-loading failure; an owned Node worker now encloses the OCR worker so success, failure and the 60-second deadline all permit cleanup. Actual invalid-image and missing-language tests terminate without hanging. Worker code, language assets, WASM and liblouis tables are explicitly included in Next.js output tracing. This is request-scoped computation, not a background job queue.

`[2026-09-17]` - Phase 2 verification made zero Gemini calls: 13 Phase 1 tests, 15 Phase 2 tests, normal/scanned fixture comparisons, and the supplied two-page text PDF passed. Supabase read-back matched both synthetic fixtures and their diagnostic jobs were deleted. `npm run verify:phase2 -- --database` repeats that check without model use; see `docs/phase2-verification.md`. OCR is English-only, successes require review, and partially scanned pages with an existing text layer do not silently use OCR for empty regions.

`[2026-09-15]` - Gemini Call Type A sets `thinkingBudget: 0`. Region classification is a narrow structured perception call that does not benefit from hidden reasoning; with the default thinking budget, the bar-chart verification image repeatedly returned provider-side HTTP 503 high-demand errors, while the otherwise-identical no-thinking request succeeded with the required schema-only output.

`[2026-09-15]` - Phase 1 renders each MuPDF page aspect-preserved and centered on a white 1000x1000 classification raster. Gemini vision sometimes emits its native 0-1000 coordinate grid even when instructed to use image pixels; making that grid equal to the actual raster dimensions removes the ambiguity without accepting, clamping, or guessing boxes. `StructuredText.asText()` only flags whether a real text layer exists, and the source document remains open for the synchronous pipeline. The upload limiter is intentionally process-local for the v1 floor, so counts reset when the server instance restarts and are not shared across server instances.

`[2026-09-15]` - The required pinned Gemini model config was missing. Added `GEMINI_MODEL` to the environment template and pinned it to `gemini-3.6-flash`: the API's available-model catalog includes it, the provider explicitly recommended it for this account, and live text/image/structured-output probes passed. `gemini-3.8-flash` and `gemini-3.7-flash` repeatedly returned provider-side HTTP 503 high-demand errors during verification. Call Type A still reads its canonical prompt text directly from `docs/prompts.md`.

`[2026-09-15]` - Phase 0 Supabase round trip passed: the development-only route created, read, and deleted a `jobs` row against the configured project. The route was removed immediately afterward.

`[2026-09-15]` - Supabase smoke test reached the configured project and returned `PGRST205` because `public.jobs` has not been created there yet. The SQL migration at `supabase/migrations/20260915000000_create_emboss_jobs.sql` must be applied before the Phase 0 round-trip can pass.

`[2026-09-15]` - Phase 0 started. The App Router scaffold and all six required core packages were already installed; their ESM imports resolved successfully. `env.example` is the repository's environment template even though several docs refer to `.env.example`.

`[unset]` — no entries yet. First real entry goes here once Phase 0 starts.
