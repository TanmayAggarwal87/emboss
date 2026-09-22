# Text processing verification

Phase 4 compatibility note: the current diagnostic classifies only the two text
fixture regions; historical references below to two untouched diagram rows describe
the original Phase 2 run. Text/OCR checks and the zero-Gemini guarantee are unchanged.

All commands below make **zero Gemini calls**. Run them from the repository root
with npm and Node 24 (the existing TypeScript test runner uses Node's experimental
type transformation). The `react-server` condition enables the standard
`server-only` package for these Node diagnostics; browser imports remain blocked.

```sh
npm run test:document-processing
npm run test:text-processing
npm run lint
npx tsc --noEmit
npm run build
```

`next build` currently needs access to Google Fonts for the pre-existing app fonts.

## Repeatable diagnostic

```sh
npm run verify:text-processing
```

This runs normal and scanned two-page fixtures through the real upload handler,
MuPDF, liblouis and local OCR, using fixed classification boxes and an in-memory
repository. It compares output with fixed UEB Grade 1/2 reference cells. It does not
test Gemini classification quality. The script refuses network requests by default.

To additionally check text extraction from your existing local PDF:

```sh
npm run verify:text-processing -- --pdf inputs/sample_text_only.pdf
```

The optional PDF test treats each entire page as a text box. It checks extraction
and translation, not region detection or chart interpretation. Your PDF is not saved
to the database. Only character counts are printed, not the PDF's text.

## Supabase read-back

```sh
npm run verify:text-processing -- --database
```

Loads the existing Supabase variables from `.env.local` without printing keys. Uses
the production repository to create synthetic jobs and verifies every saved result,
bounding box, region type, pending status, null diagram geometry, and job state by
reading Postgres. It deletes only the jobs it created (their fixture regions cascade).
No user jobs or files are removed. If cleanup fails, it prints the exact diagnostic
job ID to remove. The only allowed HTTP destination is the configured Supabase origin.

Send the command's PASS lines or error output back in chat; do not send `.env.local`.
Neither diagnostic contacts Gemini, so model quotas and 503 backoff are irrelevant.

## Evidence and limits (2026-09-17)

- 13 Phase 1 regression tests and 15 Phase 2 tests passed.
- Fixed UEB reference checks cover contractions, capitals, numbers, punctuation,
  line breaks and a long output-expansion case. Unsupported characters fail explicitly.
- Extraction tests cover neighboring columns, out-of-bounds rejection, raster
  padding, cropped pages and all four page rotations.
- A real image-only PDF fixture passed local OCR, exact text and braille comparison.
  Invalid-image and missing-language initialization tests verify failure cleanup.
- Upload tests cover successful persistence inputs, per-region errors, all-text
  failure, database failure on one page, and untouched diagram/table processing.
- Both synthetic fixtures passed Supabase write/read verification. Their temporary
  jobs and regions were removed afterward.
- `inputs/sample_text_only.pdf` passed local extraction/translation on both pages.
  Its full contents have not been independently reviewed by a braille specialist.

The installed `liblouis` 0.4.0 wrapper uses liblouis 3.2.0. Phase 2 keeps those
existing dependencies, uses the underlying translation API with checked buffer
lengths, and records the engine version in each result. English UEB and machine
printed English OCR are the tested scope. This is not braille certification or
physical embosser/export validation. Handwriting and partially scanned text on a
text-bearing page are not claimed as supported.
