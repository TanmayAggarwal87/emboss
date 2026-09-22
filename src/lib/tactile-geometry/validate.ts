import { z } from "zod";
import { diagramSchema } from "../diagram-extraction/schema.ts";
import { ACCESSIBILITY as A, profileSchema } from "./profile.ts";
import { bounds, brailleSize, elementDistance, segmentDistance } from "./measure.ts";
import type { GeometryElement, GeometryState, LineElement, ValidationIssue, XY } from "./types.ts";

const n = z.number().finite();
const positive = n.positive();
const index = n.int().nonnegative();
const xy = z.tuple([n, n]);
const id = z.string().regex(/^[a-z]+(?:-[a-z0-9]+)*$/).max(80);
const label = z.object({ id, kind: z.literal("label"), x: n, y: n, width: positive, height: positive,
  text: z.string().min(1).max(10_000), braille: z.string().min(1).max(10_000).regex(/^[\u2800-\u283f \n]+$/), anchor: id.nullable() }).strict();
const bar = z.object({ id, kind: z.literal("bar"), sourceIndex: index, x: n, y: n,
  width: n.nonnegative(), height: n.nonnegative(), rise: positive, texture: z.literal("stripes"),
  orientation: z.enum(["vertical", "horizontal"]) }).strict();
const point = z.object({ id, kind: z.literal("point"), sourceIndex: index, x: n, y: n, size: positive, rise: positive }).strict();
const line = z.object({ id, kind: z.literal("line"), role: z.enum(["axis", "data", "grid"]),
  segments: z.array(z.object({ from: xy, to: xy }).strict()).min(1).max(256), width: positive, rise: positive }).strict();
const stateSchema = z.object({
  version: z.literal(1), units: z.literal("mm"), source: diagramSchema, profile: profileSchema,
  braille: z.object({ grade: z.union([z.literal(1), z.literal(2)]), table: z.string(), version: z.string().min(1) }).strict(),
  plate: z.object({ width: positive, height: positive, thickness: positive }).strict(),
  mapping: z.object({ independent: xy, dependent: xy, x: n, y: n, width: positive, height: positive, horizontal: z.boolean() }).strict(),
  elements: z.array(z.discriminatedUnion("kind", [label, bar, point, line])).min(1).max(512),
}).strict();
const EPS = 1e-6; // Numerical comparison tolerance, not a physical clearance.
const close = (a: number, b: number) => Math.abs(a - b) <= EPS;
const same = (a: XY, b: XY) => close(a[0], b[0]) && close(a[1], b[1]);

export function validateGeometry(input: unknown): ValidationIssue[] {
  if (typeof input === "object" && input !== null && "profile" in input && !profileSchema.safeParse(input.profile).success) {
    return [{ category: "manufacturing", code: "PROFILE_INVALID", message: "The manufacturing profile cannot reproduce the required tactile hierarchy/features." }];
  }
  const parsed = stateSchema.safeParse(input);
  if (!parsed.success || parsed.data.source.chart_type === "unsupported") return [{ category: "integrity", code: "GEOMETRY_SCHEMA_INVALID",
    message: "Geometry must have a finite, strictly validated millimetre state and supported source data." }];
  const state = parsed.data as GeometryState;
  const issues: ValidationIssue[] = [];
  const add = (category: ValidationIssue["category"], code: string, message: string, elementId?: string) => {
    if (issues.length < 30) issues.push({ category, code, message, ...(elementId ? { elementId } : {}) });
  };
  const { profile: p, plate, mapping: m, source } = state;
  if (plate.width > p.maxWidth + EPS || plate.height > p.maxHeight + EPS || !close(plate.thickness, p.baseThickness)) {
    add("manufacturing", "PLATE_PROFILE", "Plate dimensions exceed the configured footprint or differ from the base thickness.");
  }
  if (state.braille.table !== `en-ueb-g${state.braille.grade}.ctb`) add("integrity", "BRAILLE_TABLE", "Braille translation metadata does not match its UEB grade.");
  const ids = new Set<string>();
  for (const element of state.elements) {
    if (ids.has(element.id) || element.id === "plate") add("integrity", "DUPLICATE_ID", "Geometry element IDs must be unique and stable.", element.id);
    ids.add(element.id);
    const b = bounds(element);
    if (b.minX < A.margin - EPS || b.minY < A.margin - EPS || b.maxX > plate.width - A.margin + EPS || b.maxY > plate.height - A.margin + EPS) {
      add("accessibility", "MARGIN", "An element violates the required plate-edge margin.", element.id);
    }
    if (element.kind === "label") {
      const size = brailleSize(element.braille);
      if (!close(size.width, element.width) || !close(size.height, element.height) || !/[\u2801-\u283f]/.test(element.braille)) {
        add("accessibility", "BRAILLE_SCALE", "Braille labels must use the fixed NLS cell and line dimensions.", element.id);
      }
      if (element.anchor) {
        const target = state.elements.find((e) => e.id === element.anchor);
        if (!target) add("integrity", "LABEL_TARGET", "The label targets a missing element.", element.id);
        else {
          const clearance = elementDistance(element, target);
          if (clearance < A.labelClearance - EPS || clearance > A.labelClearanceMax + EPS) {
            add("accessibility", "LABEL_CLEARANCE", "A direct label must be 3.18–6.35 mm from its axis.", element.id);
          }
        }
      }
    } else if (element.kind === "bar") {
      const value = source.data_points[element.sourceIndex]?.value;
      const breadth = element.orientation === "vertical" ? element.width : element.height;
      const length = element.orientation === "vertical" ? element.height : element.width;
      if (breadth < A.barMinWidth - EPS || breadth > A.barMaxWidth + EPS) add("accessibility", "BAR_WIDTH", "Bar width must remain within 9.53–25.4 mm.", element.id);
      if (value !== 0 && element.width * element.height < A.areaMin - EPS) add("accessibility", "BAR_AREA", "A nonzero bar is below the minimum tactile area.", element.id);
      if ((value === 0) !== (length === 0)) add("integrity", "ZERO_BAR", "Zero values must not be rendered as positive bars or nonzero values hidden.", element.id);
      if (!close(element.rise, p.barRise)) add("manufacturing", "BAR_RISE", "Bar relief differs from the manufacturing profile.", element.id);
      if (length > 0 && (breadth < 2 * p.stripeInset + p.stripeWidth || length < 2 * p.stripeInset + p.stripeWidth)) {
        add("manufacturing", "TEXTURE_FIT", "The bar cannot contain the selected texture without undersized features.", element.id);
      }
    } else if (element.kind === "point") {
      if (element.size < A.plottedPointMin - EPS) add("accessibility", "POINT_SIZE", "A plotted point is below the 3 mm minimum.", element.id);
      if (!close(element.rise, p.pointRise)) add("manufacturing", "POINT_RISE", "Point relief differs from the manufacturing profile.", element.id);
    } else {
      const role = element.role;
      const width = role === "axis" ? p.axisWidth : role === "data" ? p.dataWidth : p.gridWidth;
      const rise = role === "axis" ? p.axisRise : role === "data" ? p.dataRise : p.gridRise;
      if (!close(element.width, width) || !close(element.rise, rise)) add("manufacturing", "LINE_PROFILE", "A line violates its profile width/height and tactile hierarchy.", element.id);
      if ((role === "data" && element.rise <= p.axisRise) || (role === "axis" && (element.rise <= p.gridRise || element.rise >= p.dataRise)) ||
        (role === "grid" && element.rise >= p.axisRise)) add("accessibility", "TACTILE_HIERARCHY", "Data must be more prominent than axes, and axes more prominent than grid lines.", element.id);
      if (element.segments.some((s) => same(s.from, s.to))) add("integrity", "EMPTY_SEGMENT", "A line contains an empty segment.", element.id);
      if (role === "grid") {
        for (const s of element.segments) {
          const length = Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]);
          if (!close(length, p.gridDash) || !(close(s.from[0], s.to[0]) || close(s.from[1], s.to[1]))) {
            add("manufacturing", "GRID_PATTERN", "Grid lines must use the configured axis-aligned dash pattern.", element.id);
          }
        }
        for (let i = 0; i < element.segments.length; i++) for (let j = i + 1; j < element.segments.length; j++) {
          if (segmentDistance(element.segments[i], element.segments[j]) < p.gridGap - EPS) add("accessibility", "GRID_GAP", "Grid dashes lack required blank space.", element.id);
        }
      }
    }
  }
  // Permit only explicit semantic connections, not broad role-based collision exemptions.
  for (let i = 0; i < state.elements.length; i++) for (let j = i + 1; j < state.elements.length; j++) {
    const a = state.elements[i], b = state.elements[j];
    if (zeroBar(a) || zeroBar(b) || connected(a, b)) continue;
    if (elementDistance(a, b) < A.separation - EPS) add("accessibility", "ELEMENT_SEPARATION", `Elements ${a.id} and ${b.id} need at least 3 mm of blank space.`, a.id);
  }
  const expectedHorizontal = source.chart_type === "bar_chart" && source.orientation === "horizontal";
  if (m.horizontal !== expectedHorizontal) add("integrity", "ORIENTATION", "Geometry does not preserve the extracted bar orientation.");
  if (source.data_points.some((point) => point.value === null) || source.independent_axis.values.some((value) => value === null)) {
    add("integrity", "MISSING_DATA", "Unreadable data cannot be converted to geometry.");
    return issues;
  }
  const values = source.data_points.map((point) => point.value!);
  const independent = source.independent_axis.type === "numeric" ? source.independent_axis.values as number[] : values.map((_, i) => i);
  if (!same(m.independent, [independent[0], independent.at(-1)!]) || m.dependent[0] > Math.min(0, ...values) ||
    m.dependent[1] < Math.max(0, ...values) || !(m.dependent[1] > m.dependent[0])) {
    add("integrity", "AXIS_DOMAIN", "Axis domains do not represent the original values and zero baseline.");
  }
  if (independent.length > 1 && independent.some((v, i) => i > 0 && (v - independent[i - 1]) * Math.sign(m.independent[1] - m.independent[0]) <= 0)) {
    add("integrity", "AXIS_ORDER", "Numeric positions must be distinct and strictly ordered.");
  }
  const positions = independent.map((value, i): XY => {
    const f = independent.length === 1 ? 0.5 : (value - m.independent[0]) / (m.independent[1] - m.independent[0]);
    const v = (values[i] - m.dependent[0]) / (m.dependent[1] - m.dependent[0]);
    return m.horizontal ? [m.x + v * m.width, m.y + (1 - f) * m.height] : [m.x + f * m.width, m.y + v * m.height];
  });
  const independentLabelAxis = m.horizontal ? "y" : "x";
  const dependentLabelAxis = m.horizontal ? "x" : "y";
  const legendLabels = state.elements.filter((element): element is Extract<GeometryElement, { kind: "label" }> =>
    element.kind === "label" && element.id.startsWith("legend-key-"));
  const legendCodeToLabel = new Map<string, string>();
  const expectedLegendEntries = new Set<string>();
  const categoricalValues = source.independent_axis.type === "categorical" ? source.independent_axis.values : [];
  for (const [index, legend] of legendLabels.entries()) {
    const match = /^([a-z0-9]{2}) (.+)$/.exec(legend.text);
    if (legend.id !== `legend-key-${index}` || !match || !categoricalValues.includes(match[2])) {
      add("integrity", "LEGEND_ENTRY", "Legend entries must use stable IDs, unique two-character codes and source category labels.", legend.id);
      continue;
    }
    const existing = legendCodeToLabel.get(match[1]);
    if ((existing && existing !== match[2]) || (existing === match[2])) {
      add("integrity", "LEGEND_CODE", "A legend code must identify exactly one distinct source category.", legend.id);
    }
    legendCodeToLabel.set(match[1], match[2]);
  }
  const requireLabel = (labelId: string, text: string, axis: string, coordinate: number, allowLegendCode = false) => {
    const e = state.elements.find((candidate) => candidate.id === labelId);
    const textMatches = e?.kind === "label" && (e.text === text || (allowLegendCode && legendCodeToLabel.get(e.text) === text));
    if (!e || e.kind !== "label" || !textMatches || e.anchor !== `${axis}-axis` ||
      !close(axis === "x" ? e.x + e.width / 2 : e.y + e.height / 2, coordinate)) {
      add("integrity", "AXIS_LABEL", "An axis label is missing, misaddressed or does not match its source value/position.", labelId);
    } else if (allowLegendCode && e.text !== text) {
      expectedLegendEntries.add(`${e.text} ${text}`);
    }
  };
  positions.forEach((position, i) => requireLabel(`label-${independentLabelAxis}-${i}`,
    String(source.independent_axis.values[i]), independentLabelAxis, m.horizontal ? position[1] : position[0],
    source.independent_axis.type === "categorical"));
  if (legendLabels.length !== expectedLegendEntries.size || legendLabels.some((legend) => !expectedLegendEntries.has(legend.text))) {
    add("integrity", "LEGEND_MAPPING", "Every short category label must have exactly one matching full-label legend entry.");
  }
  const tickValues = [...new Set([m.dependent[0], 0, m.dependent[1]])].sort((a, b) => a - b);
  tickValues.forEach((value, i) => {
    const fraction = (value - m.dependent[0]) / (m.dependent[1] - m.dependent[0]);
    requireLabel(`label-${dependentLabelAxis}-${i}`, String(value), dependentLabelAxis,
      m.horizontal ? m.x + fraction * m.width : m.y + fraction * m.height);
  });
  const sourceElements = state.elements.filter((e) => e.kind === "bar" || e.kind === "point");
  if (sourceElements.length !== values.length) add("integrity", "DATA_COUNT", "Every source datum must retain its own element, including zero bars.");
  positions.forEach((position, i) => {
    const barChart = source.chart_type === "bar_chart";
    const element = state.elements.find((e) => e.id === `${barChart ? "bar" : "point"}-${i}`);
    if (!element || (element.kind !== "bar" && element.kind !== "point") || element.sourceIndex !== i ||
      (barChart ? element.kind !== "bar" : element.kind !== "point")) {
      add("integrity", "SOURCE_ID", "Source index and deterministic element ID do not agree."); return;
    }
    if (element.kind === "point") {
      if (!same([element.x, element.y], position)) add("integrity", "DATA_POSITION", "A plotted point does not preserve proportional numeric positions.", element.id);
    } else {
      const z = -m.dependent[0] / (m.dependent[1] - m.dependent[0]);
      const baseline = m.horizontal ? m.x + z * m.width : m.y + z * m.height;
      const start = m.horizontal ? element.x : element.y;
      const length = m.horizontal ? element.width : element.height;
      const valuePosition = m.horizontal ? position[0] : position[1];
      const centre = m.horizontal ? element.y + element.height / 2 : element.x + element.width / 2;
      if (element.orientation !== (m.horizontal ? "horizontal" : "vertical") ||
        !close(start, Math.min(baseline, valuePosition)) || !close(length, Math.abs(valuePosition - baseline)) ||
        !close(centre, m.horizontal ? position[1] : position[0])) add("integrity", "BAR_PROPORTION", "Bar geometry does not preserve its sign, source position or proportional value.", element.id);
    }
  });
  const axes = state.elements.filter((e): e is LineElement => e.kind === "line" && e.role === "axis");
  const xAxis = axes.find((e) => e.id === "x-axis"), yAxis = axes.find((e) => e.id === "y-axis");
  if (axes.length !== 2 || !xAxis || !yAxis || xAxis.segments.length !== 1 || yAxis.segments.length !== 1 ||
    !same(xAxis.segments[0].from, yAxis.segments[0].from) || !close(xAxis.segments[0].from[1], xAxis.segments[0].to[1]) ||
    !close(yAxis.segments[0].from[0], yAxis.segments[0].to[0])) add("integrity", "AXES", "The two named axes must be connected, horizontal/vertical lines.");
  const dataLines = state.elements.filter((e): e is LineElement => e.kind === "line" && e.role === "data");
  if (source.chart_type === "line_graph_single_series") {
    if (dataLines.length !== positions.length - 1) add("integrity", "LINE_COUNT", "The line must connect every consecutive source point.");
    let length = 0;
    for (let i = 1; i < positions.length; i++) {
      const dataLine = dataLines.find((e) => e.id === `data-segment-${i - 1}`);
      if (!dataLine || dataLine.segments.length !== 1 || !same(dataLine.segments[0].from, positions[i - 1]) || !same(dataLine.segments[0].to, positions[i])) {
        add("integrity", "LINE_CONNECTION", "The data line no longer connects its own source points in order.");
      }
      length += Math.hypot(positions[i][0] - positions[i - 1][0], positions[i][1] - positions[i - 1][1]);
    }
    if (length < A.dataPathMin - EPS) add("accessibility", "DATA_LINE_LENGTH", "The connected data path is below its 25.4 mm minimum.");
  } else if (dataLines.length) add("integrity", "UNEXPECTED_LINE", "A single-series bar chart cannot acquire a fabricated data line.");
  return issues;
}

function zeroBar(e: GeometryElement): boolean { return e.kind === "bar" && (e.width === 0 || e.height === 0); }
function connected(a: GeometryElement, b: GeometryElement): boolean {
  if (a.kind === "line" && b.kind === "line") {
    if (a.role === "axis" && b.role === "axis") return true;
    if (a.role === "data" && b.role === "data") {
      const left = /^data-segment-(\d+)$/.exec(a.id), right = /^data-segment-(\d+)$/.exec(b.id);
      return !!left && !!right && Math.abs(Number(left[1]) - Number(right[1])) === 1;
    }
  }
  if (a.kind === "point" && b.kind === "line" && b.role === "data") {
    const match = /^data-segment-(\d+)$/.exec(b.id);
    return !!match && (a.sourceIndex === Number(match[1]) || a.sourceIndex === Number(match[1]) + 1);
  }
  return b.kind === "point" && a.kind === "line" ? connected(b, a) : false;
}
