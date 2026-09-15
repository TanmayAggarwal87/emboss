# Testing Scope — Emboss v1

This file exists to stop scope creep in the other direction: don't build for scale,
volume, or generality this version doesn't need. Every boundary below is intentional,
not a placeholder to "fix later" unless explicitly noted.

---

## Document scope

- **Test inputs are PDFs, 2-3 pages maximum.**
- Documents will contain a realistic mix of plain text, at least one diagram
  (bar chart or single-series line graph), and optionally a simple table.
- Do not build pagination, batching, or multi-document upload handling for v1. One
  PDF, one job, processed synchronously, start to finish.
- Do not optimize for documents beyond ~3 pages. If someone uploads a 40-page PDF,
  it's acceptable for v1 to reject it outright with a clear message rather than
  attempt to process it slowly or partially.

## Diagram scope

- Only **bar charts** and **single-series line graphs** are supported. See
  `docs/bana-standards.md` §9 for the explicit exclusion list (pie charts,
  multi-series lines, scatter plots, molecular/circuit diagrams, maps, 3D
  drawings/clocks/spinners/pictographs).
- Do not attempt best-effort geometry generation for an unsupported diagram type —
  fail with a clear message identifying what was detected and that it isn't
  supported yet.
- Do not build a "diagram type plugin system" or similar generalized architecture
  in v1 anticipating future diagram types. Two types, hardcoded logic paths, is the
  right amount of engineering for this scope. Generalize later if/when a third type
  is actually added.

## Table scope

- Only **simple rectangular tables**: single header row, no merged cells, no nested
  tables. See `docs/bana-standards.md` §8 for the full exclusion list (Punnett-square
  style tables without perimeter lines, stem-and-leaf plots).
- Detecting a table that doesn't fit this shape should result in an explicit
  rejection/flag for that region, not a best-effort attempt.

## Processing scope

- **No background job queue.** Processing happens synchronously within the request
  lifecycle for this test scope. If processing genuinely proves too slow for a
  2-3 page document once real testing starts, that's a signal to revisit — not a
  reason to pre-build queueing infrastructure now.
- **No retry/backoff infrastructure beyond basic error handling.** If a Gemini call
  fails, surface the failure clearly (per-region, so one failed diagram doesn't sink
  the whole job) rather than building a sophisticated retry system for v1.
- **Zod validation retry**: a Gemini response that fails validation is retried up to
  **3 total attempts** before that region is marked failed. This is the one defined
  retry behavior in v1 — don't add retry logic anywhere else without a reason.
- **Upload size cap: 7 MB.** Enforced before any processing starts. Reject over-cap
  uploads with a clear message, don't attempt partial processing.
- **Abuse guard: 5 upload requests per IP.** A basic floor, not a full rate-limiting
  system — appropriate given there's no auth standing between the public upload
  route and Gemini spend. Don't over-build this for v1.

## Cost/token scope

- Log Gemini token usage per call during testing (see AGENTS.md §4 for which two call
  types exist) — this is cheap to add now and gives real per-document cost data
  before any decision about scaling past 2-3 pages.
- Watch specifically for any Gemini call creeping into a stage that should be
  MuPDF/liblouis/deterministic-only (see `docs/pipeline.md`, "Cost/token discipline"
  section) — this is the most likely place scope quietly expands token cost without
  anyone deciding it should.

## Review/edit scope

- Test with a small number of edit-prompt iterations per region (e.g. 1-3), not an
  unbounded edit loop. If a region needs more than a few edit rounds to reach
  approval during testing, that's a signal the initial geometry generation or
  extraction step needs attention, not that the edit loop needs to run longer.
- No edit history UI is required for v1 testing, even if the `edits` table (see
  `docs/data-model.md`) is implemented — showing edit history is a nice-to-have
  demo point, not a functional requirement to test against.

## Explicitly not in v1 testing scope

- Auth, accounts, login flows
- Persistent job history across sessions
- Any file storage bucket / long-term artifact retention
- Multi-floor, multi-document, or batch processing
- Any diagram or table type not explicitly listed as supported above
- Mobile-specific testing (build responsively where reasonable, but v1 testing target
  is desktop browser use by a sighted reviewer)

## What "done" looks like for v1 testing

A 2-3 page PDF containing plain text, one supported diagram, and optionally one
simple table can be uploaded and, without any manual intervention beyond the
review/approve/edit-prompt steps in the UI, produce a downloadable package containing
correct braille text and a validated, BANA-compliant STL file — end to end, in one
sitting, without needing to touch the database or backend manually.