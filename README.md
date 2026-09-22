# Emboss

Emboss is being built to convert short PDF documents into accessible output for blind and
low-vision readers. The v1 pipeline extracts text and simple tables as braille,
and turns supported bar charts and single-series line graphs into tactile,
3D-printable STL geometry. AI is used for perception; deterministic code owns
measurements, geometry, and BANA validation.

The web UI uploads documents and compares original region crops with validated
3D tactile previews. Approval, editing and export stages are not yet implemented.

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
npm run test:document-processing
npm run test:text-processing
npm run test:table-processing
npm run test:diagram-extraction
npm run test:classification-recovery
npm run test:tactile-geometry
npm run test:preview
npm run verify:preview
```

### Running the App & Phase 6 Preview UI

1. Start the development server with `npm run dev` (or build and start in production mode via `npm run build && npm run start`).
2. Navigate to `http://localhost:3000` in your web browser.
3. Upload a 2–3 page PDF with charts or tables.
4. When processing completes, the application automatically transitions from the "Processing" stage to the "Review" workspace.
5. In the Review Workspace, each detected region is presented side-by-side:
   - **Original Source**: Exact high-resolution crop rasterized directly from the PDF by MuPDF.
   - **Tactile / Braille Preview**: For diagram regions, an interactive client-rendered Three.js 3D mesh is shown, displaying tactile elevation hierarchy, bar textures, and fixed braille labels. For text and tables, formatted braille output is displayed.
   - **Interactive Camera Controls**: Reviewers can reset the 3D angle, switch to top-down view, zoom in/out, or orbit the model with mouse drag or accessible keyboard buttons.

**Important Preview Lifecycle & Security Notes:**
- **Source crops are temporary**: Rasterized source crops are stored strictly in-memory within a bounded LRU cache (50 MB limit, 15-minute TTL) and served privately via `/api/jobs/[jobId]/regions/[regionId]/source`. They are never uploaded to Supabase Storage, never written to persistent disk, and never sent back to Gemini.
- **Cache expiry & serverless behavior**: If a session expires or if the request is handled by a different serverless instance, the crop route returns HTTP 410 (Gone). The tactile geometry and review status remain intact in Postgres.
- **Mesh reuse for export**: The Three.js mesh object rendered in the preview is the exact same geometry object that will be exported to STL in Phase 8 (`AGENTS.md` §7).
- **Subsequent phases**: Approval, edit-prompt corrections, and ZIP package export belong to Phase 7 and Phase 8. In Phase 6, reviewers visually verify generated tactile relief against original source graphics without active edit or export actions.

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

`npm run test:classification-recovery` runs offline fault-injection tests and spends no Gemini quota.

## Project documentation

- [Agent instructions](AGENTS.md)
- [Task list](TASKS.md)
- [Pipeline](docs/pipeline.md)
- [Text processing verification](docs/text-processing-verification.md)
- [Table processing verification](docs/table-processing-verification.md)
- [Compliance report](docs/compliance-report.md)

See the linked documents for architecture, supported scope, data contracts, and
accessibility standards.
