# Phase 3 verification

Verified on 2026-09-17. Phase 3 implements deterministic real-text table extraction,
UEB braille formatting, per-region errors, and image-table routing only. No Phase 4
model calls, geometry, review UI, or export were added.

## Repeatable checks

```bash
npm run test:phase3
npm run verify:phase3
npm run verify:phase3 -- --artifacts
npm run verify:phase3 -- --database
```

The diagnostic generates a three-page PDF: a valid ruled table, a merged-cell
table, and an image table on a page with a real-text heading. It uses fixed fixture
boxes instead of Gemini classification. These commands make **zero Gemini calls**;
the diagnostic blocks network requests except the configured Supabase origin when
`--database` is explicitly selected. No dev server is required.

By default it uses an in-memory repository. `--database` uses the existing local
Supabase configuration, inserts one synthetic job and three regions, reads back
their types/data/bounds/review state, and deletes only that job and its cascading
regions in `finally`. A cleanup failure reports the job ID for manual cleanup.
It does not delete pre-existing jobs or upload bytes to Storage.

`--artifacts` writes a generated PDF, first-page raster, and table-result JSON into
a new OS temporary directory, printed by the script, for visual inspection. These
are local test artifacts, not a debug route or production persistence mechanism.

## Recorded results

- Phase 3: 12/12 tests passed; Phase 1: 13/13; Phase 2: 15/15.
- `npm run lint`, `npx tsc --noEmit`, and `npm run build` passed. The production
  build required network access for Next.js font fetching, not model access.
- Real MuPDF fixtures passed for stroked grids, thin filled-rectangle grids, and
  unruled aligned columns. Source headers/rows and empty cells matched exactly.
- Merged cells, additional bold header rows, stem-and-leaf, perimeter-less Punnett,
  clipped boxes, invalid bounds, and ambiguous unruled empty cells were rejected.
- Image-only tables and image tables on mixed text/image pages routed to diagrams.
- Braille checks covered fixed Grade 1 references, numeric/text alignment, exactly
  3 blank separating cells, header blank line, dot-5 spacing, centered two-hyphen
  empty cells, vertical fallback, repeated headers, and 40-cell/25-line limits.
- Mixed-success upload returned 207 without losing good regions; all-failed tables
  returned 422 and marked their job failed. PDF handles were closed.
- Offline diagnostic passed; generated source raster was visually inspected against
  the retained headers/rows and braille layout. This was not an embosser test.
- Supabase diagnostic passed: exactly 3 regions, types `table/table/diagram`, correct
  cells/braille/error/null handoff, matching boxes/pages, pending review, null geometry.
  Its synthetic rows were removed. The first sandboxed attempt could not create a
  job (database/network error); the authorized network-enabled run above succeeded.

## Limitations

These are synthetic fixtures with deterministic boxes, not new live Call Type A
accuracy evidence. Unstyled multi-row headers cannot reliably be distinguished from
body rows; every success records the first-row assumption and requires review.
Only complete grids or clear unruled alignment are accepted; sparse unruled tables,
partial rules, complex clipping/overpainting, and decorative layouts are not verified.
Image overlap conservatively reroutes the region, including mixed-content tables.

UEB translation uses the existing liblouis engine; formatting checks are in braille
cells/lines, not millimeters. Physical BANA conformance, specialist transcription
review, and blind-reader legibility remain unverified. `braille_pages` contains
bounded text sections, not an exported package. All regions remain pending review.
