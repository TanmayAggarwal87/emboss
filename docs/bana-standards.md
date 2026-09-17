# BANA Standards Reference — Emboss

This file separates BANA/NLS-derived accessibility constraints from the explicitly
approved **Emboss v1 manufacturing profile**. Manufacturing choices are not BANA
requirements or physical certification. Sections 1–2, 4–10 record accessibility
constraints; sections 3 and 11 identify manufacturing dimensions. Where approximate
inch/mm conversions differ, use the stated millimetre value. The 2022 source is at
https://www.brailleauthority.org/guidelines-and-standards-tactile-graphics.

Units are given in mm where the project uses mm internally, with the original
inch specs alongside where that's how BANA states them.

---

## 1. Braille cells & general page layout

- **BANA/NLS nominal educational/paper braille profile**: dot height 0.48 mm,
  dot base diameter 1.44 mm, adjacent-dot centres 2.34 mm within each cell,
  corresponding-dot cell pitch 6.2 mm, and line pitch 10.0 mm. Never scale these.
  Source: https://www.brailleauthority.org/size-and-spacing-braille-characters.
  Adopting this for educational FDM plates is an Emboss production choice, not
  ADA/signage braille or certification of a printed sample.
- Maximum tactile graphic size: **40 cells wide, 25 lines long** on standard
  11.5" x 11" paper, for text/table layout. Diagram plates use the explicit
  180 x 180 mm FDM footprint in section 11, including margins and base.
- Keep the table/graphic frame at least **6.35 mm (1/4")** away from the physical
  page edge (margin, to avoid binding/thumb interference).
- Always place tactile graphics starting at the **left margin** of the page, so a
  reader's hands find the start position consistently.

## 2. Size & density minimums (general)

- Minimum area size: **1/4 square inch**
- Minimum length for primary/data lines: **25.4 mm (1.0 inch)**
- Generic distinguishable point symbols: **6 mm minimum** (approximately 1/4 inch).
  Plotted graph points have a separate **3 mm minimum** under section 6.
- General simplification cap: a single diagram should contain **no more than 5**
  distinct area textures, **5** line styles, and **5** point-symbol types. If a
  diagram would need more than this to represent its data, it is out of v1 scope —
  fail explicitly rather than cramming more distinctions in.

## 3. Line weight hierarchy (charts)

Height and texture — never color — are what distinguish line types. Three tiers,
strictly ordered by prominence (data lines strongest, grid lines weakest):

The hierarchy is BANA-derived. The numerical heights below are **Emboss v1
manufacturing ranges**, not claimed BANA-prescribed millimetres. Defaults are
data 0.9, axis 0.55, grid 0.25 mm above the base; widths appear in section 11.

| Line class | Use for | Height | Notes |
|---|---|---|---|
| **Data / primary line** | Trend line on a graph, shape outline | **0.80 mm – 1.00 mm** | Top profile: distinct ridge or rounded crest. Minimum length 25.4 mm. |
| **Axis line** | X/Y axes | **0.50 mm – 0.60 mm** | Must read as lower than data lines, higher than grid lines. |
| **Grid line** | Background grid | **0.20 mm – 0.30 mm** | Use dashed/dotted texture, not solid. If too tall, it competes with the data line for attention — keep it low. |

## 4. Spacing & clearance rules

- **Minimum element separation**: **3 mm** of flat blank space between unrelated
  objects. Intentional connections (axes meeting, a plotted line joining its own
  points/adjacent segments, texture attached to its own bar) are exempt. Grid
  fragments leave this space around data and points. Braille dots within one label
  follow the NLS cell profile, not inter-object spacing.
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
  3 mm minimum separation as the floor.
- Single-series categories identified by braille labels need no complex per-category
  texture coding. Emboss uses one repeatable raised-stripe fill to distinguish bars
  from background. Reuse always has the same meaning. Multi-series, stacked and
  grouped bars require additional semantics and remain unsupported.
- Bar orientation (vertical/horizontal) should match the source print chart unless
  physically impossible to reproduce.

## 6. Line graphs (single-series only, v1)

- Plotted graph points are at least **3 mm** across; v1 uses a 3 mm square.
  This is distinct from the 6 mm generic-symbol rule, not a global 3–4 mm range.
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

The dimensional values in this table are **Emboss manufacturing choices**, not
BANA-prescribed millimetres. Phase 3 emits braille text, not these physical borders.
The historical 0.20 mm row-guide relief is not the 0.48 mm NLS braille-dot height.

| Element | Profile | Height | Top width |
|---|---|---|---|
| Top & bottom boxing border | Solid, smooth flat-top ridge | 0.50 mm – 0.60 mm | 1.00 mm |
| Column dividers (vertical) | Dash-spaced low ridges | 0.25 mm – 0.30 mm | 0.80 mm |
| Row dividers (horizontal) | Dotted micro-domes | 0.20 mm | 1.44 mm (base) |

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

## 11. Emboss v1 manufacturing profile (not BANA/NLS requirements)

Diagram plates target ordinary FDM printers with at least a 220 x 220 mm bed.
UEB text/table output is translated content for downstream embossing. Neither
output targets or simulates a proprietary printer/embosser model.

| Parameter | Default | Classification |
|---|---|---|
| Maximum complete plate width / height | 180 / 180 mm | Emboss manufacturing |
| Base thickness | 2.0 mm | Emboss manufacturing |
| Grid / axis / data width | 0.8 / 1.2 / 1.6 mm | Emboss manufacturing |
| Grid / axis / data rise | 0.25 / 0.55 / 0.9 mm | Emboss manufacturing |
| Minimum raised-feature width / rise | 0.8 / 0.2 mm | Emboss manufacturing |
| Bar body / stripe extra rise | 0.8 / 0.2 mm | Emboss manufacturing |
| Plotted-point rise | 1.0 mm | Emboss manufacturing |
| Stripe width / pitch / edge inset | 0.8 / 4.0 / 1.6 mm | Emboss manufacturing |
| Grid dash length / blank gap | 3.0 / 3.0 mm | Emboss manufacturing |
| Solid-feature penetration into base | 0.05 mm | Emboss manufacturing |

`MAX_PLATE_WIDTH_MM`, `MAX_PLATE_HEIGHT_MM`, and `TACTILE_PLATE_THICKNESS_MM`
configure the plate. Blank/unset values use these defaults. Remaining production
settings live in a separate profile object; immutable NLS dimensions and BANA
spacing rules are not overridden by it. Invalid profiles fail explicitly.
The 180 mm envelope includes the 6.35 mm margins, with no extra outer rim.

Connected data lines use section 2's 25.4 mm minimum **total path length**, not a
minimum for each short segment. Nonzero filled bars use the 161.29 mm² minimum
area (1/4 square inch). A zero value has no invented positive-length bar and stays
explicitly labelled. Numeric axes are linear and proportional; bar magnitude axes
include zero and negative values keep their side of zero. Missing values and
unsupported logarithmic/broken axes are never guessed. Overcrowded layouts fail.

Validation reports accessibility and manufacturing violations separately. Software
checks do not establish printer calibration, physical legibility or expert approval.
