# COMPONENTS.md — Emboss

Living registry of every reusable frontend component in this repo. **Check this file
before creating any new component.** If something close to what you need already
exists, extend or reuse it — don't create `DiagramPreview2.tsx` next to an existing
`DiagramPreview.tsx` because it was faster than checking. If you do create a new
component, add it here in the same commit/session — this file is only useful if it
stays current.

This is different from `STRUCTURE.md`: that file shows the folder tree. This file
answers "what does this component actually do, and can I reuse it?" — one row per
component, not a file listing.

---

## How to use this file

**Before creating a component:**
1. Search this table for anything with overlapping purpose.
2. If something's close but not quite right, prefer adding a prop/variant to the
   existing component over forking a near-duplicate.
3. If nothing fits, create the new component, then add a row here before considering
   the task done.

**When editing an existing component:**
- Update its row's description if its purpose/props meaningfully changed.
- If you're tempted to add a one-off variant that only one screen will ever use,
  consider whether that logic belongs in the parent screen instead of the shared
  component — shared components should stay genuinely shared.

**Naming convention:** components are PascalCase, named for what they show, not
where they're used (e.g. `RegionReviewCard`, not `Step5Component`).

---

## shadcn/ui primitives

Base components installed via `npx shadcn@latest add <name>` live under
`components/ui/` and are **not** listed individually here — they're documented by
shadcn itself. List a shadcn primitive here only if it's been meaningfully
customized/wrapped for this project beyond default shadcn styling (add a row noting
what was changed and why).

| shadcn component | Customized? | Notes |
|---|---|---|
| _unset — populate once `docs/frontend.md` and shadcn setup are finalized_ | | |

---

## Project-specific components

Populate this table as components are actually built. Do not pre-fill speculative
rows for components that don't exist yet — that defeats the purpose of this being a
source of truth. One row per real component.

| Component | Location | Purpose | Reused by / used on | Key props | Notes |
|---|---|---|---|---|---|
| _unset_ | _unset_ | _unset_ | _unset_ | _unset_ | _unset_ |

### Suggested component groupings (for reference while building — not prescriptive)

Based on the pipeline stages in `docs/pipeline.md`, these are the natural component
groupings likely to emerge. Use this as a checklist for "have I already built
something like this" — not as a spec of components that must exist.

- **Upload flow:** file drop/select UI, upload progress/error states (size limit,
  page limit, rate limit messages — see `docs/project-overview.md` for exact wording
  context)
- **Job status:** processing indicator, per-page/per-region status list
- **Region review:** a card/panel per region showing its type, status
  (pending/approved/edit_requested/rejected), and available actions — likely one
  shared component parameterized by region type, not three separate components for
  text/diagram/table review if their shape is similar enough
- **Diagram preview:** the 3D mesh renderer (three.js) + side-by-side source image
  comparison — this is likely the most complex component in the app; keep the raw
  three.js rendering logic separated from the surrounding review UI so it can be
  reused in both the review screen and (if ever needed) a read-only preview
- **Edit-prompt input:** text input + submit for the plain-English edit instruction,
  plus a way to show the edit agent's result (applied / unsupported with reason)
- **Export/download:** final package download UI, listing what's included and what
  was excluded (rejected regions)
- **Braille text preview/output:** for text and table regions — how the braille
  result is shown to a sighted reviewer (who can't read braille) is worth deciding
  deliberately, e.g. showing the back-translated plain text alongside a
  representation of the braille, not just raw braille dot-pattern characters

---

## Anti-duplication checklist (re-check before adding a component)

- [ ] Did I search this file for an existing component with overlapping purpose?
- [ ] If something similar exists, did I consider extending it (new prop/variant)
      before creating a new file?
- [ ] Am I about to build a second version of something because the first felt
      "specific to one screen" — could that actually be a prop instead?
- [ ] Did I add a row here for anything genuinely new before finishing the task?