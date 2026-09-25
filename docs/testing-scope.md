# Testing Scope — Emboss v1

This file exists to stop scope creep in the other direction: don't build for scale,
volume, or generality this version doesn't need. Every boundary below is intentional,
not a placeholder to "fix later" unless explicitly noted.

---

## Document scope

- **Test inputs are PDFs, 1-3 pages maximum.**
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

Phase 3's verified subset is complete ruled grids (including empty data cells) and
consistently aligned unruled tables without missing cells. Ambiguous, partial-grid,
clipped, or rotated layouts fail locally. Header identification remains provisional
for unstyled multi-row headers; the first-row assumption is explicitly recorded for
human review. Image tables route to diagram processing and are unsupported unless
they actually contain a supported chart; there is no table OCR or AI table-text
transcription. See `docs/table-processing-verification.md` for the original Phase 3 evidence.

## Processing scope

- **No background job queue.** Processing happens synchronously within the request
  lifecycle for this test scope. If processing genuinely proves too slow for a
  1-3 page document once real testing starts, that's a signal to revisit — not a
  reason to pre-build queueing infrastructure now.
- **Bounded Call A recovery only.** At user request, classification retries HTTP
  429/503 after 30 then 90 seconds, with two extra requests shared across validation
  attempts. Disable SDK retries. Other errors do not automatically retry. Keep
  pages sequential and expose failures without losing successful pages. This is
  not a queue, generalized retry framework, or automatic Call B retry feature.
- **Zod validation retry**: a Gemini response that fails validation is retried up to
  **3 total attempts** before that page/region is marked failed. This validation
  budget remains separate from Call A's two extra transport requests.
- **Upload size cap: 7 MB.** Enforced before any processing starts. Reject over-cap
  uploads with a clear message, don't attempt partial processing.
- **Abuse guard: 5 upload/retry requests per IP.** A basic floor, not a full rate-limiting
  system — appropriate given there's no auth standing between the public upload
  route and Gemini spend. Don't over-build this for v1.

## Classification recovery verification

Run `npm run test:classification-recovery` alongside all domain test scripts, `npm run lint`,
`npx tsc --noEmit`, and `npm run build`. Tests inject errors and instant sleepers:
they verify the 30/90-second schedule without real waiting or Gemini traffic.
Coverage includes 429/503 recovery/exhaustion, non-transient errors, cancellation,
separate Zod budgets, sequential pages, success preservation, subset retry/replay,
cooldown/caps, concurrent retry exclusion, expiry/capacity, database checkpoint
reuse, and insert-on-conflict idempotence after a simulated lost acknowledgement.
Repository fault injection exercises the Supabase client against a fake transport,
not the hosted database; it is not a new live database or model accuracy test.

For manual use, keep the upload response's `job_id` and `retry` metadata, wait until
`available_after`, then send `{"pages":[2]}` to its retry URL. Never run a repeated
upload loop. Sessions last 15 minutes on the same Node process, with three manual
retry requests and a one-minute cooldown; both endpoints share the existing IP
guard. Its counts reset on process restart, not after a timed window. The deployment
proxy must supply trustworthy client-IP headers. Multi-instance storage/rate limits
are outside this v1 floor; independent serverless instances cannot resume the PDF.
See `README.md` for host-duration requirements. Persistent failures can still occur:
this verifies recovery mechanics, not provider uptime or perception consistency.

## Cost/token scope

- Log Gemini token usage per call during testing (see AGENTS.md §4 for which two call
  types exist) — this is cheap to add now and gives real per-document cost data
  before any decision about scaling past 3 pages.
- Watch specifically for any Gemini call creeping into a stage that should be
  MuPDF/liblouis/deterministic-only (see `docs/pipeline.md`, "Cost/token discipline"
  section) — this is the most likely place scope quietly expands token cost without
  anyone deciding it should.

## Phase 4 verification

```bash
npm run test:diagram-extraction
npm run verify:diagram-extraction -- --artifacts
npm run verify:diagram-extraction -- --database
npm run verify:diagram-extraction -- --live --database --artifacts
```

Tests and default diagnostics use fixed responses and make zero model requests.
`--live` makes at most two Call B requests against generated bar/line chart crops,
with one attempt each and no Call A; it stops on the first error or mismatch.
To resume only one chart after waiting through a provider failure, add
`--chart line` or `--chart bar`. Do not repeatedly upload whole PDFs to retest one
failed chart. `--database` reads back the resulting synthetic diagram rows and
deletes only its own test job/regions. `--artifacts` prints a temporary directory
containing the source PDF, chart crops and result JSON for visual comparison.

The fixture checks chart types, labels, exact values, and strict response shape;
it is a limited perception sample, not proof of accuracy on arbitrary diagrams.
Physical constraints and rendered output are outside Phase 4 verification.

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

A 1-3 page PDF containing plain text, one supported diagram, and optionally one
simple table can be uploaded and, without any manual intervention beyond the
review/approve/edit-prompt steps in the UI, produce a downloadable package containing
correct braille text and a validated, BANA-compliant STL file — end to end, in one
sitting, without needing to touch the database or backend manually.
