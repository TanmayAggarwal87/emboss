<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
# AGENTS.md — Emboss

Read this file first, in full, before writing any code. It is the source of truth for
architecture, scope, and non-negotiable rules. If anything you're about to do
contradicts this file, stop and follow this file.

## 1. What Emboss is

Emboss converts a short PDF document (2-3 pages, v1 scope) into a braille- and
tactile-ready output package for blind and low-vision readers:

- Plain text → braille text (via liblouis)
- Diagrams (bar charts, single-series line graphs) → 3D-printable tactile STL files,
  validated against BANA 2022 tactile graphics standards
- Simple rectangular tables → braille-formatted tables (via liblouis + BANA table rules)

The person uploading is a sighted reviewer (teacher, publisher, volunteer) preparing
accessible material for a blind reader — not the blind reader themselves in v1. The
reviewer visually verifies the tactile output on a 3D preview before export.

## 2. The one rule that overrides every other decision

**AI proposes. Deterministic code disposes.**

Gemini is used only for perception and judgment: reading an image, classifying a
region, extracting the data shown in a diagram. Gemini is never trusted to produce
final geometry, final measurements, or final spacing. Every millimeter value in the
final output comes from deterministic code checked against `docs/bana-standards.md`,
never from a model's guess.

If you are about to let an LLM output a coordinate, a height in mm, a spacing value,
or raw mesh geometry — stop. That value must come from code, using the BANA constants,
not from the model.

## 3. Pipeline (follow this order, do not skip stages)

```
PDF upload
  → page raster (MuPDF)
  → region classification (Gemini — bounding box + type label ONLY, see §4)
  → route by region type:
      - text    → MuPDF text-layer extraction → liblouis → braille text
      - table   → MuPDF text extraction (if real text table) → BANA table rules → braille table
                  (if table is an embedded image, treat as a diagram region instead)
      - diagram → Gemini structured-data extraction (see §4) → deterministic geometry
                  generation (three.js) → deterministic BANA validation
  → preview (3D mesh + original source image side by side)
  → human review: approve / edit-prompt / reject
      - edit-prompt → scoped, schema-checked operation → re-run BANA validation → back to preview
  → approved → export (STL for diagrams, braille text for text/tables) → combined output package
```

Full detail: `docs/pipeline.md`.

## 4. Gemini's job is narrower than it looks — two different calls, never blur them

**Call type A — region classification ("Job B" internally, named for the design
discussion that settled it):**
Input: one page raster image.
Output: a list of regions, each with a bounding box and a type label
(`text` | `diagram` | `table`).
Gemini must NOT return the text content of a `text` region. If a response contains
transcribed body text, that is a bug — the real text always comes from MuPDF's text
layer, never from Gemini, because MuPDF is free and exact and Gemini is neither.

**Call type B — diagram data extraction:**
Input: the cropped image of a single region already classified as `diagram`.
Output: structured JSON describing what the diagram shows — chart type, bar
orientation, data points, semantic independent-axis values/type, axis labels and
legend/series labels. NOT geometry, NOT rendering coordinates, NOT mm dimensions.
Deterministic code turns this JSON into validated geometry.

Never combine these two calls. Never let classification also transcribe. Never let
diagram extraction also decide spacing or size.

**When a Gemini response fails Zod validation:** retry the same call up to
**3 attempts total** (`MAX_GEMINI_VALIDATION_RETRIES`, see `.env.example`). If all 3
fail validation, mark that specific region as failed (do not fail the entire job —
other regions on the same page/document should still be able to succeed) and surface
a clear per-region error message. Never fall back to using an invalid/unvalidated
response just to avoid a failure state.

## 5. Scope boundaries for v1 — do not silently expand these

- Input: PDFs, 2-3 pages, tested scope. Don't build for arbitrary document length yet.
- Diagram types supported: **bar charts, single-series line graphs only.**
  Pie charts, multi-series line graphs, scatter plots, molecular/circuit diagrams,
  maps, and 3D drawings are explicitly NOT supported in v1. If a diagram doesn't match
  a supported type, fail with a clear message — do not attempt a best-effort geometry.
- Tables supported: **simple rectangular tables only** (single header row, no merged
  cells). Punnett-square-style tables and stem-and-leaf plots are explicitly excluded
  per BANA guidance (stem-and-leaf must never be produced as a tactile graphic).
- No authentication. No persistent per-user history. No file storage bucket — process
  in memory/tmp per session. Only job status + geometry JSON persist briefly in
  Postgres (Supabase), keyed by an unguessable job ID (link-based access, not login).
- No background job queue in v1 — synchronous processing.
- **Upload size cap: 7 MB** (`MAX_UPLOAD_SIZE_MB`, see `.env.example`), enforced on
  the upload route. Reject with a clear message above this, before any processing
  starts — don't let a large file reach MuPDF/Gemini first.
- **Basic abuse guard: 5 upload requests per IP** (`RATE_LIMIT_UPLOADS_PER_IP`). This
  is a floor, not a full rate-limiting system — since there's no auth, this is the
  only thing standing between the upload route and unbounded Gemini spend. Don't
  build more than this for v1, but don't skip it either.

## 6. Physical scale rules (do not violate these)

- Graphic elements (bars, lines, point symbols, spacing) are scaled **dynamically**,
  computed by code to satisfy BANA minimums for the given data density, capped at a
  maximum plate size.
- Braille text/cell dimensions are **always constant** — never scaled with the
  graphic, regardless of what scale factor the rest of the diagram uses.
- If the minimum legal size for a diagram's data exceeds the max plate size, fail
  explicitly with a clear message. Never silently shrink geometry below BANA minimums
  to force a fit.
- All dimensional constants live in `docs/bana-standards.md`, with BANA/NLS constraints
  separated from the approved Emboss FDM manufacturing profile. Do not hardcode a BANA
  number anywhere except by referencing that file — if a value you need isn't there,
  stop and ask rather than estimating it.

## 7. Geometry and rendering

- three.js only — `ExtrudeGeometry` and primitives for additive/extrude-and-place
  construction. No CSG/boolean-mesh library (e.g. Manifold) — v1 has no subtractive
  geometry requirement.
- The exact same mesh object that renders in the web preview is exported to STL. Do
  not regenerate geometry separately for export — that risks a preview/export mismatch.

## 8. Edit-prompt step

- The edit agent receives a plain-English instruction and the current geometry state.
- It may only emit schema-checked operations against real, addressable elements
  (e.g. move, resize, relabel a specific element by ID) — never raw geometry, never a
  full regeneration.
- Every edit result is re-run through the same deterministic BANA validation as the
  original generation before being shown again. An edit is never trusted just because
  a human requested it.
- Element IDs follow the approved deterministic scheme in `docs/data-model.md`.
  Preserve them across validation, preview and future edits/export.

## 9. Tech stack

- Frontend: Next.js
- Backend: Next.js route handlers (not Nest.js) — one repo, smaller surface area
- DB: Supabase (Postgres)
- ORM: Drizzle, only if/when the plain Supabase client genuinely becomes insufficient
  — do not add it preemptively
- PDF parsing: MuPDF
- Braille translation: liblouis (never hand-roll Grade 1/2 rules)
- Geometry/rendering: three.js
- AI: Gemini (model selection per available API — see project config, not hardcoded
  here since it may change)
- Validation: Zod on every AI output before it touches the deterministic pipeline
- Background jobs: none in v1

## 10. Reference docs

- `docs/pipeline.md` — full stage-by-stage technical flow and data contracts between stages
- `docs/bana-standards.md` — the only source of truth for tactile dimensions/spacing.
  Consult before writing any geometry code. Do not estimate a BANA number from memory.
- `docs/data-model.md` — DB schema, job lifecycle, element ID scheme (once finalized)
- `docs/testing-scope.md` — explicit v1 test boundaries, so features aren't
  over-built for scale this version doesn't need
- `docs/prompts.md` — the canonical, version-controlled system prompt text for both
  Gemini call types. If a prompt needs to change, change it here first, not ad hoc
  inside a route handler — this file is what keeps the "AI proposes, code disposes"
  boundary from Section 4 actually enforced at the prompt level, not just in theory.

## 11. When in doubt

If a task seems to require guessing a physical measurement, expanding scope beyond
§5, or letting an LLM output something more precise than "what did you see" —
stop and flag it rather than proceeding on a best guess.

## 12. Project-wide config notes

- TypeScript `strict: true` is enabled in `tsconfig.json` — keep it on. Given how
  much of this project's safety depends on typed contracts between pipeline stages
  (Zod schemas, geometry JSON shapes, element IDs), do not weaken this.
- Package manager: **npm only.** Do not introduce Bun, pnpm, or yarn, and do not
  assume any package-manager-specific tooling beyond what plain npm provides.
