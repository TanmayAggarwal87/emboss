# Emboss

Emboss is being built to convert short PDF documents into accessible output for blind and
low-vision readers. The v1 pipeline extracts text and simple tables as braille,
and turns supported bar charts and single-series line graphs into tactile,
3D-printable STL geometry. AI is used for perception; deterministic code owns
measurements, geometry, and BANA validation.

The current web UI is still a Next.js scaffold. Later human-review, edit, and
export stages are not yet implemented.

## Development

This project uses npm only.

```bash
npm install
npm run dev
npm run lint
```

Open [http://localhost:3000](http://localhost:3000) after starting the dev
server.

Copy `env.example` to `.env.local` and fill in the required local values before
running the application. Keep `.env.local` private and never commit it.

Available verification commands include:

```bash
npm run test:phase1
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:retry
```

Phase 4 chart extraction can be checked offline with `npm run verify:phase4`.
For a capped real Gemini test, run `npm run verify:phase4 -- --live --database`:
at most two chart requests, stopping on the first failure, with synthetic database
rows removed afterward. Add `--artifacts` to inspect the generated PDF, crops and
results locally. Existing `docs/testing-scope.md` describes the options.

## Retrying failed classification pages

Call A retries only HTTP 429/503, waiting 30 then 90 seconds, with SDK retries
disabled. Upload/retry processing stays sequential. The response includes per-page
errors and a `retry` object identifying eligible pages and the next allowed time.
After that time, send JSON to the returned URL, for example:

```http
POST /api/jobs/<job_id>/retry
Content-Type: application/json

{"pages":[2]}
```

Do not resend the PDF. Successfully processed pages are not reclassified. This
endpoint retries **page-level failures**, not individual failed diagram/text/table
results on a classified page. It allows three retry requests per job, a one-minute
cooldown, and shares the existing five-request IP guard with uploads.

The source PDF is held temporarily in memory for at most a 15-minute session
(an active request may finish before cleanup). Completion releases PDF bytes early.
Use one long-lived Node process, or routing that keeps both endpoints on the same
process. Separate serverless functions/replicas do not share sessions: a restart,
expiry or wrong instance returns HTTP 410, while saved database rows remain intact.
The host/proxy must permit long requests: routes declare `maxDuration = 600`, with
a 180-second cooperative pipeline deadline and time for active downstream work to
finish. Platform limits still apply; retries cannot guarantee provider availability
or identical visual classifications. No permanent file storage was added.

`npm run test:retry` runs offline fault-injection tests and spends no Gemini quota.

## Project documentation

- [Agent instructions](AGENTS.md)
- [Task list](TASKS.md)
- [Pipeline](docs/pipeline.md)
- [Phase 2 verification](docs/phase2-verification.md)
- [Phase 3 verification](docs/phase3-verification.md)
- [Compliance report](docs/compliance-report.md)

See the linked documents for architecture, supported scope, data contracts, and
accessibility standards.
