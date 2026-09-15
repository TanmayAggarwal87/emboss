# Emboss — Compliance & Validation Report

**Status line — update every time this file changes:**
`[YYYY-MM-DD]: <one honest sentence on where evidence actually stands>`

Current status (template — replace before first real entry):
`[unset]: No test runs yet. This file has no data until Phase 5/9 testing begins.`

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

Add rows as new geometry types are implemented. Remove this note once the table has
real entries.

---

## B. Pipeline evidence

Track actual end-to-end runs here — not capability claims, actual attempts.

**Test documents run:** _0 so far_

| Document | Date | Pages | Regions detected (text/diagram/table) | Outcome | Notes |
|---|---|---|---|---|---|
| _unset_ | _unset_ | _unset_ | _unset_ | _unset_ | _unset_ |

**Outcome** should be one of: `complete success`, `partial success (N/M regions
succeeded)`, `failed — <named reason>`. Never leave a failure undocumented just
because a later run succeeded — both are evidence.

---

## C. Known limitations / provisional results

Use this section the way you'd warn a teammate, not the way you'd write marketing
copy. Examples of the kind of honesty this section needs (replace with real ones as
they come up):

- _e.g. "Bar chart geometry tested on only 2 sample charts so far — both had 4-6
  bars. Untested at higher bar counts near the plate-size failure boundary."_
- _e.g. "Line graph point-symbol placement passes validation but hasn't been
  reviewed by an actual sighted tester comparing mesh to source — validator passing
  is not the same as confirmed legible."_
- _e.g. "Table guide-dot rendering implemented per spec but not yet cross-checked
  against a real embosser or physical print."_

---

## D. What this report explicitly does not claim

- Passing the deterministic validator is not the same as confirming legibility for
  an actual blind reader via physical print testing — that's a separate, harder kind
  of evidence this project has not gathered (see the earlier honest conversation
  about lived-experience input; this file can't substitute for that).
- "Conforms" in Section A means "matches the numeric constant," not "has been
  validated by a domain expert or BANA-certified transcriber."