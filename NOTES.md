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
