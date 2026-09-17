# Emboss — Compliance & Validation Report

`[2026-09-17]: Phase 4 live bar/line data extraction and Supabase verification passed alongside 53 automated tests; physical conformance and complete v1 end-to-end output remain unverified.`

---

## How to use this file (read before editing)

This file is a record of **evidence**, not intentions. A row only gets a checkmark or
a value once a real validator run, real test document, or real comparison has
produced it. If something "should" conform per `docs/bana-standards.md` but hasn't
actually been run through the validator yet, it does not go in this file — it stays
a task in `TASKS.md` until it's been tested.

Be as willing to write "this failed" or "this is untested" as "this passed." A report
that only ever shows green checkmarks is not a compliance report, it's marketing —
and it stops being useful for catching real problems the moment it stops being
honest. If a result is shaky, provisional, or based on a small sample, say so
explicitly in the row or in Section C, the way you'd flag it to a teammate who's
about to rely on it.

Three separate concerns, do not blend them:

- **A. Physical/BANA specification conformance** — deterministic geometry values
  checked against `docs/bana-standards.md` and the validator. This should be the
  most reliable section, since it's pure code + fixed numbers, not judgment.
- **B. Pipeline evidence** — how many real test documents have actually been run
  end-to-end, and what happened.
- **C. Known limitations / provisional results** — anything in A or B that's true but
  shaky: small sample size, edge case not covered, a result you don't fully trust yet.

---

## A. Physical / BANA specification conformance

Populate this table from real validator runs, referencing the exact constant/section
in `docs/bana-standards.md` each row checks against. Do not estimate a "should be"
value — only record what the code actually generated and whether the validator
accepted it.

| Parameter | Emboss generated value | BANA standard (see `bana-standards.md` §) | Conforms? | Verified how / when |
|---|---|---|---|---|
| Data/primary line height | _unset_ | §3, 0.80–1.00 mm | _unset_ | _unset_ |
| Axis line height | _unset_ | §3, 0.50–0.60 mm | _unset_ | _unset_ |
| Grid line height | _unset_ | §3, 0.20–0.30 mm | _unset_ | _unset_ |
| Minimum element separation | _unset_ | §4, 3.18 mm | _unset_ | _unset_ |
| Label clearance | _unset_ | §4, 3.18–6.35 mm | _unset_ | _unset_ |
| Bar width (min/max) | _unset_ | §5, 9.53–25.4 mm | _unset_ | _unset_ |
| Line-graph point-symbol base width | _unset_ | §6, 3.0–4.0 mm | _unset_ | _unset_ |
| Table column separation (3-cell rule) | _unset_ | §8, ~18.6 mm | _unset_ | _unset_ |
| Table border heights (if used) | _unset_ | §8 border table | _unset_ | _unset_ |
| Page/plate margin | _unset_ | §1, 6.35 mm | _unset_ | _unset_ |

No geometry validator has run yet. Physical rows above intentionally remain unset.

### Phase 3 braille text-layout evidence (not physical measurements)

Tests below ran on 2026-09-17 in `tests/phase3/format.test.ts`; source constants
are in `docs/bana-standards.md` §§1/8. They do not establish millimeter dimensions,
embosser behavior, or expert transcription approval.

| Check | Observed result | Evidence scope |
|---|---|---|
| Column separation | 3 blank braille cells | Aligned fixture rows/header |
| Header separation | 1 blank line | Each aligned output section |
| Alignment | Text left, numbers right | Name/Count fixture |
| Guide dots | Dot 5 with 1 intervening blank | Spare text-column padding; column gap stays blank |
| Empty cells | Centered two-hyphen indicator | Empty Count cell |
| Text page limits | At most 40 cells/line, 25 lines/section | Aligned, vertical-list, and multi-section fixtures |
| Oversized content | Explicit failure | Unbreakable value exceeds 40 cells |

Fixed Grade 1 examples matched expected Unicode braille. This limited reference
check is not a full UEB transcription audit.

---

## B. Pipeline evidence

Track actual end-to-end runs here — not capability claims, actual attempts.

**Complete upload-to-reviewed-export test documents run:** 0. The later stages
are not implemented; scoped phase diagnostics below do not count as end-to-end runs.

| Document | Date | Pages | Regions detected (text/diagram/table) | Outcome | Notes |
|---|---|---|---|---|---|
| _unset_ | _unset_ | _unset_ | _unset_ | _unset_ | _unset_ |

**Outcome** should be one of: `complete success`, `partial success (N/M regions
succeeded)`, `failed — <named reason>`. Never leave a failure undocumented just
because a later run succeeded — both are evidence.

### Scoped phase evidence

- Phase 2 evidence is recorded in `docs/phase2-verification.md`.
- Phase 3, 2026-09-17: 12/12 table tests and all 28 Phase 1/2 regression tests passed.
  Strict TypeScript, lint, and the production build passed.
- One generated three-page fixture used fixed classification boxes (not Gemini):
  a valid text table produced matching cells/braille; a merged table failed locally;
  an image table on a mixed page became a pending diagram. HTTP 207 was expected.
  Source raster/cell output was visually inspected. No physical sample was produced.
- Offline diagnostic passed. Initial sandboxed database attempt failed before job
  creation with a database/network error. Authorized network-enabled verification
  then read back exactly three matching `table/table/diagram` rows, all pending with
  null geometry, and deleted its synthetic job/regions. Zero Gemini calls were made.
- Commands, artifacts and limitations: `docs/phase3-verification.md`.

### Phase 4 evidence — 2026-09-17

- 13/13 Phase 4 tests plus 40/40 earlier-phase tests passed. Lint, strict TypeScript,
  production build, and the offline Phase 2/3/4 diagnostics passed. The built upload
  route's file trace includes the canonical prompt Markdown.
- Tests covered strict nested schemas, forbidden geometry/coordinate fields,
  malformed JSON, finite values, exact validation attempt limits, null-value review
  flags, unsupported types, crop failures, and no repeated HTTP calls on 429/503.
  Same-page/later-page successes survived a failed diagram; all-failed regions
  marked the job failed. Image tables used the diagram handoff; text tables made
  no Call B request.
- Live Call B on generated PDF crops: `Monthly totals` bar chart returned
  Jan=10, Feb=20, Mar=30; `Monthly trend` single-series line graph returned
  Jan=5, Feb=15, Mar=10. Both matched `Month`/`Count` axis labels and series labels.
  Crops and result JSON were inspected together. These were fixed fixture boxes,
  not a fresh live Call A classification accuracy test.
- First live run: bar passed and was persisted; line returned a service error and
  the diagnostic stopped. After working on build/docs for several minutes, a
  line-only run passed. Exactly 3 Gemini requests in total; no automatic HTTP
  retries. The two successful calls reported 2113 and 2116 total tokens; usage for
  the failed request was unavailable, so this is not a full request-cost estimate.
- Line-only Supabase read-back matched exactly one diagram row, its source page
  and box, validated data, pending review, and null geometry. Both live runs removed
  their synthetic jobs/regions. PDF and crop bytes were never persisted to Supabase.
- Repeatable commands and quota limits are in `docs/testing-scope.md`. No new
  verification Markdown file was created for this phase.

---

### Classification recovery evidence (2026-09-17)

- Reproduced the missing transient-503 recovery before the fix; the regression now
  passes. 18 offline recovery tests and all 53 earlier phase tests passed, together
  with lint, strict TypeScript and the production build. Both route traces include
  the canonical prompts, OCR worker and liblouis tables.
- Simulated 429/503, exhausted budgets, non-transient failures, cancellation,
  sequential/subset retry, preservation of successful results, session expiry,
  cooldown/concurrency/caps, and a lost database acknowledgement. Supabase SDK
  requests used an injected transport for the idempotence check, not a live DB.
- Zero live Gemini calls were made for this follow-up. These tests establish retry
  mechanics only, not improved provider uptime or identical classifications.
- Sessions require the same running Node process within 15 minutes; restarts or
  separate serverless workers return 410. Saved database results are not deleted.
  Page-level retry does not repair an individual failed downstream region on a
  classified page. Physical conformance remains unverified.

## C. Known limitations / provisional results

- Synthetic table fixtures are a small sample. No new live classification accuracy
  test was run for Phase 3; fixed boxes deliberately avoided Gemini quota use.
- Clear merged/incomplete grids and styled multi-header cases are rejected, but
  unstyled multi-row headers cannot be reliably distinguished from data. Every
  successful table retains a first-row header assumption warning and pending review.
- Sparse unruled tables and ambiguous structures fail rather than being guessed.
  Complex PDF clipping/overpainting and decorative table layouts are not verified.
- Image overlap conservatively routes a table through diagram extraction. Genuine
  table images are unsupported by Call B's bar/line schema; table OCR is not provided.
- Phase 4's live evidence is one simple labeled bar chart and one simple labeled
  line graph. Schema validation cannot prove that a model read a value correctly;
  source comparison and human approval remain necessary. Null values are retained
  and flagged for data review before geometry can be generated.
- Guide dots and braille layout have not been tested with an embosser, physical
  print, specialist transcriber, or blind reader. Cell-space checks are not mm checks.
- Geometry, review, edits, exports, and the full v1 acceptance run remain pending.

---

## D. What this report explicitly does not claim

- Passing the deterministic validator is not the same as confirming legibility for
  an actual blind reader via physical print testing — that's a separate, harder kind
  of evidence this project has not gathered (see the earlier honest conversation
  about lived-experience input; this file can't substitute for that).
- "Conforms" in Section A means "matches the numeric constant," not "has been
  validated by a domain expert or BANA-certified transcriber."
