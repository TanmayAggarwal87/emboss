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

`[2026-09-15]` - Gemini Call Type A sets `thinkingBudget: 0`. Region classification is a narrow structured perception call that does not benefit from hidden reasoning; with the default thinking budget, the bar-chart verification image repeatedly returned provider-side HTTP 503 high-demand errors, while the otherwise-identical no-thinking request succeeded with the required schema-only output.

`[2026-09-15]` - Phase 1 renders each MuPDF page aspect-preserved and centered on a white 1000x1000 classification raster. Gemini vision sometimes emits its native 0-1000 coordinate grid even when instructed to use image pixels; making that grid equal to the actual raster dimensions removes the ambiguity without accepting, clamping, or guessing boxes. `StructuredText.asText()` only flags whether a real text layer exists, and the source document remains open for the synchronous pipeline. The upload limiter is intentionally process-local for the v1 floor, so counts reset when the server instance restarts and are not shared across server instances.

`[2026-09-15]` - The required pinned Gemini model config was missing. Added `GEMINI_MODEL` to the environment template and pinned it to `gemini-3.6-flash`: the API's available-model catalog includes it, the provider explicitly recommended it for this account, and live text/image/structured-output probes passed. `gemini-3.8-flash` and `gemini-3.7-flash` repeatedly returned provider-side HTTP 503 high-demand errors during verification. Call Type A still reads its canonical prompt text directly from `docs/prompts.md`.

`[2026-09-15]` - Phase 0 Supabase round trip passed: the development-only route created, read, and deleted a `jobs` row against the configured project. The route was removed immediately afterward.

`[2026-09-15]` - Supabase smoke test reached the configured project and returned `PGRST205` because `public.jobs` has not been created there yet. The SQL migration at `supabase/migrations/20260915000000_create_emboss_jobs.sql` must be applied before the Phase 0 round-trip can pass.

`[2026-09-15]` - Phase 0 started. The App Router scaffold and all six required core packages were already installed; their ESM imports resolved successfully. `env.example` is the repository's environment template even though several docs refer to `.env.example`.

`[unset]` — no entries yet. First real entry goes here once Phase 0 starts.
