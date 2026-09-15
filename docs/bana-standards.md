# BANA Standards Reference — Emboss

This file is the **only** source of truth for tactile dimensions, spacing, and layout
rules in this project. It is a distilled reference drawn from the BANA 2022 Guidelines
and Standards for Tactile Graphics — not the full 420-page document, and not a raw
text dump of it. Numbers here are law: geometry code must reference these values, not
estimate or invent them. If a value you need for a task isn't listed here, stop and
ask rather than guessing.

Units are given in mm where the project uses mm internally, with the original
inch specs alongside where that's how BANA states them.

---

## 1. Braille cells & general page layout

- Exact braille cell size/spacing varies slightly by embosser — defer to embosser
  spec at export time, not hardcoded here as a single number.
- Maximum tactile graphic size: **40 cells wide, 25 lines long** on standard
  11.5" x 11" paper. Treat this as the effective max plate size for v1 unless a
  different physical print bed size is configured.
- Keep the table/graphic frame at least **6.35 mm (1/4")** away from the physical
  page edge (margin, to avoid binding/thumb interference).
- Always place tactile graphics starting at the **left margin** of the page, so a
  reader's hands find the start position consistently.

## 2. Size & density minimums (general)

- Minimum area size: **1/4 square inch**
- Minimum length for primary/data lines: **25.4 mm (1.0 inch)**
- Minimum diameter for point symbols: **6.35 mm (1/4 inch)**, for reliable
  discrimination by touch
- General simplification cap: a single diagram should contain **no more than 5**
  distinct area textures, **5** line styles, and **5** point-symbol types. If a
  diagram would need more than this to represent its data, it is out of v1 scope —
  fail explicitly rather than cramming more distinctions in.

## 3. Line weight hierarchy (charts)

Height and texture — never color — are what distinguish line types. Three tiers,
strictly ordered by prominence (data lines strongest, grid lines weakest):

| Line class | Use for | Height | Notes |
|---|---|---|---|
| **Data / primary line** | Trend line on a graph, shape outline | **0.80 mm – 1.00 mm** | Top profile: distinct ridge or rounded crest. Minimum length 25.4 mm. |
| **Axis line** | X/Y axes | **0.50 mm – 0.60 mm** | Must read as lower than data lines, higher than grid lines. |
| **Grid line** | Background grid | **0.20 mm – 0.30 mm** | Use dashed/dotted texture, not solid. If too tall, it competes with the data line for attention — keep it low. |

## 4. Spacing & clearance rules

- **Minimum element separation**: **3.18 mm (1/8")** of flat blank space between any
  two lines, symbols, or distinct objects. (One general spacing spec also states
  1/8" minimum between a point symbol and any other component — treat 3.18 mm as the
  universal floor.)
- **Label clearance**: braille labels must sit **3.18 mm – 6.35 mm (1/8" – 1/4")**
  away from the graphic line/component they identify.
- **Label blank-space allowance**: minimum 1/8" blank space on all sides of a label
  embedded within an area texture.
- **Don't-intersect rule**: a line must never cross directly through a braille label.
  If a lead line points to a label, it must stop exactly 3.18 mm short of the braille
  cell — never touch or overlap it.
- Labels are placed **horizontally** only.
- If a label runs over to a second line, the runover is **left-justified**, not
  indented.

## 5. Bar charts

- Bar width: **minimum 6.35 mm (1/4")**, general spec; a more specific BANA figure
  also states **3/8" minimum, 1" maximum** width (excluding histograms) — use the
  **3/8" (9.53 mm) minimum** as the binding constraint for v1, since it's the more
  specific figure, and cap width at **1" (25.4 mm)**.
- Bars must be separated with enough gap to distinguish the background grid, but
  close enough that lengths remain visually/tactually comparable — apply the general
  3.18 mm minimum separation as the floor.
- Do not render bars as flat solid plastic when they represent different categories —
  differentiate categories using distinct 3D textures (cross-hatching, stripes,
  stipple/dot pattern), not color.
- Bar orientation (vertical/horizontal) should match the source print chart unless
  physically impossible to reproduce.

## 6. Line graphs (single-series only, v1)

- Plot each data point as a small raised 3D shape (triangle, square, or star),
  base width **3.0 mm – 4.0 mm**.
- Connect data-point shapes with the primary data line (see §3 for line height spec).
- The plotted/data line must always be the tactually strongest line on the graph.
  Axis lines stronger than grid lines, grid lines weakest — never invert this order.
- v1 supports **one series per chart only**. Multi-series (multiple lines needing
  shape/texture differentiation) is explicitly out of scope — reject or flag rather
  than attempting to render multiple series.

## 7. Pie charts — not supported in v1

BANA itself recommends avoiding pie charts where possible, since angle judgment by
touch is unreliable. Emboss does not generate pie chart geometry in v1. If a region
is classified as a diagram and identified as a pie chart, fail with a clear message
rather than attempting a best-effort render. (Reference spec, for future version: every
slice needs a fully distinct 3D fill texture; labels via lead lines to a braille key,
never placed inside the slice.)

## 8. Tables (simple rectangular only, v1)

### Structure & alignment
- Left-align text columns, right-align purely numeric columns.
- Leave one blank line between column headings and the first data row.
- **3-cell rule**: columns must be separated by a minimum of **3 blank braille cells
  (~18.6 mm)**. If a table cannot fit on one page at this spacing, split it into
  sections or convert to a vertical list — do not compress spacing below this floor.
- For wide tables, do not use solid 3D grid lines to help row-tracking. Instead, use
  guide dots (braille Dot 5, ⠐) spaced one cell apart between columns, acting as a
  tactile "railing" for the finger.
- Keep the table frame at least **6.35 mm (1/4")** from the physical page edge.

### Border geometry (only if a table genuinely requires visual/tactile segmentation)

| Element | Profile | Height | Top width |
|---|---|---|---|
| Top & bottom boxing border | Solid, smooth flat-top ridge | 0.50 mm – 0.60 mm | 1.00 mm |
| Column dividers (vertical) | Dash-spaced low ridges | 0.25 mm – 0.30 mm | 0.80 mm |
| Row dividers (horizontal) | Dotted micro-domes (Dot 5) | 0.20 mm (match text dot) | 1.44 mm (base) |

- **Never use full visual grid boxes** — a densely boxed grid feels like a solid
  block of plastic to a finger and hides the content inside it entirely.
- **Never leave a data cell blank.** An empty cell must be filled with a standardized
  hyphen indicator (⠤⠤), centered in the column space, so the reader doesn't perceive
  the layout as broken.

### Explicitly excluded from v1 (do not attempt to generate)
- **Punnett-square-style tables** shown without perimeter lines — not supported.
- **Stem-and-leaf plots** — per BANA, these must never be produced as a tactile
  graphic at all; they are brailled as numeric-code text instead. If detected, route
  to text/braille handling, not diagram/geometry handling — or reject if that routing
  isn't feasible in v1.

## 9. Diagram types explicitly out of scope for v1

Reject with a clear message rather than attempting a best-effort render for any of:
- Pie charts (see §7)
- Multi-series line graphs
- Scatter plots
- Molecular / circuit diagrams
- Maps
- 3D drawings / clocks / spinners / pictographs

These are real, documented BANA categories with their own rules (kept out of this
file since they're out of scope) — worth revisiting in a future version, not v1.

## 10. Physical scale computation rule (ties to AGENTS.md §6)

- Graphic elements scale dynamically per diagram, computed by code to satisfy every
  minimum in this file simultaneously, capped at the max plate size (§1).
- Braille text/cell dimensions never scale — always constant, regardless of the
  graphic's computed scale factor.
- If the smallest legal layout (every element at its BANA minimum) still exceeds the
  max plate size, generation must fail explicitly. Never output geometry that
  violates a minimum in this file to force a fit.
