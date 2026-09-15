# Data Model — Emboss

This file describes persisted state, the job lifecycle, and access pattern. Read
`AGENTS.md` §5 and §9 first — no auth, no file storage bucket, minimal persistence.

---

## What actually needs to persist

Emboss does not keep user history and has no login. The only reason anything touches
the database at all is that a single document's journey through classification →
per-region processing → human review → edit → export happens across multiple
requests in one session, so *something* needs to hold state between those requests.

**Persisted (Supabase Postgres, short-lived):**
- Job status
- Per-region processing state and results (geometry JSON, extracted text/table data,
  review status)

**Not persisted:**
- The uploaded PDF file itself, beyond the lifetime of the active job
- Rendered page rasters, beyond the lifetime of the active job
- Final exported packages, beyond the lifetime of the active job
- Any user identity or account data — there is none

Where the actual PDF bytes / raster images live during processing (in-memory, tmp
disk, or a short-lived object) is an implementation detail, not a schema concern —
just don't reach for a persistent storage bucket to solve it, per AGENTS.md §5.

---

## Access pattern (no auth)

- A job is created on upload and identified by an **unguessable job ID** (e.g. a UUID
  or similarly high-entropy token) — not a sequential/guessable ID.
- The reviewer accesses the job's status/preview/review screens via a URL containing
  that job ID, the same way a Figma or Google Docs share link works — knowledge of
  the URL is the only access control there is in v1.
- Do not build a login, session, or per-user job list. If "what jobs have I created"
  ever becomes a real need, that's a v2 conversation requiring real auth — don't
  half-build it now.
- Jobs should be treated as expiring / cleanable after some reasonable window (exact
  TTL not critical for v1 test scope, but don't design as if job rows live forever).

---

## Proposed tables (draft — adjust during implementation, this isn't sacred)

### `jobs`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | the unguessable job ID used in the share URL |
| `status` | enum | `processing` \| `ready_for_review` \| `exported` \| `failed` |
| `created_at` | timestamp | |
| `page_count` | int | for the v1 2-3 page scope check |
| `error_message` | text, nullable | populated on `failed`, e.g. "diagram too dense for plate size" or "unsupported diagram type" |

### `regions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `job_id` | uuid, FK → jobs | |
| `page_number` | int | |
| `type` | enum | `text` \| `diagram` \| `table` |
| `bounding_box` | jsonb | `{x, y, width, height}` from Stage 2 classification |
| `review_status` | enum | `pending` \| `approved` \| `edit_requested` \| `rejected` |
| `extracted_data` | jsonb | text string (text regions), structured table data (table regions), or structured diagram data from Gemini Call Type B (diagram regions) — see Stage 3c in `docs/pipeline.md` |
| `geometry` | jsonb, nullable | only for diagram regions — the validated geometry/element state, structure TBD (see below) |
| `created_at` / `updated_at` | timestamp | |

### `edits` (optional — only if you want an edit history, not required for v1 function)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `region_id` | uuid, FK → regions | |
| `prompt_text` | text | the reviewer's plain-English instruction |
| `applied_operation` | jsonb | the schema-checked operation the edit agent emitted |
| `created_at` | timestamp | |

This table is a nice-to-have for demoing "here's what human review caught," not a
functional requirement — skip it if it adds friction, add it back if you want that
demo point.

---

## Element ID scheme for diagram geometry — **not finalized**

This is deliberately left open. The `geometry` field on a `regions` row needs some
stable, addressable structure so that Stage 5a (edit-prompt) can target specific
elements — e.g. "move bar_3 left" needs `bar_3` to be a real, stable identifier that
both the geometry generator and the edit agent agree on.

**Do not invent this ad hoc mid-implementation.** When this is needed, define it as
its own short spec (likely a simple convention like `{type}_{index}`, e.g. `bar_1`,
`axis_x`, `label_2`, `point_3`) and confirm it before wiring the edit agent against
it, since every downstream piece (geometry generation, validation, edit-prompt
targeting, re-validation) depends on this staying consistent.

---

## Job lifecycle (state transitions)

```
upload
  → processing (Stages 1-3 running)
  → ready_for_review (all regions classified + processed, at least one needs review)
      → [per region] approved / edit_requested / rejected
      → once all regions are in a terminal per-region state (approved or rejected):
  → exported (Stage 6-7 complete, package generated)

  → failed (at any stage — e.g. unsupported diagram type, PDF page count out of
    scope, minimum-legal geometry exceeds plate size)
```

Note: `review_status` lives per-region, while `status` lives per-job. A job only
reaches `exported` once every non-rejected region has been explicitly approved —
partial/silent export of un-reviewed regions should not be possible.
