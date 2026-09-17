import "server-only";
import { Box3, Mesh } from "three";
import { diagramSchema, type SupportedDiagramData } from "../phase4/schema.ts";
import { translateBraille } from "../phase2/braille.ts";
import { ACCESSIBILITY as A, profileSchema, type PhysicalProfile } from "./profile.ts";
import { bounds, brailleSize, elementDistance } from "./measure.ts";
import type { BarElement, GeometryElement, GeometryProcessor, GeometryResult, GeometryState, LabelElement, LineElement, XY } from "./types.ts";
import { validateGeometry } from "./validate.ts";
import { buildGeometryMesh, disposeGeometryMesh } from "./mesh.ts";

export class GeometryError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
const fail = (message: string): never => { throw new GeometryError("GEOMETRY_TOO_DENSE", message); };
type Tick = { fraction: number; label: LabelElement };

export class DeterministicGeometryProcessor implements GeometryProcessor {
  constructor(private readonly profile: PhysicalProfile, private readonly grade: 1 | 2) {}
  process(data: SupportedDiagramData): GeometryResult {
    try {
      const geometry = generateGeometry(data, this.profile, this.grade);
      const mesh = buildGeometryMesh(geometry);
      try {
        const box = new Box3().setFromObject(mesh);
        if (box.min.x < -1e-4 || box.min.y < -1e-4 || box.min.z < -1e-4 ||
          box.max.x > geometry.plate.width + 1e-4 || box.max.y > geometry.plate.height + 1e-4) {
          throw new GeometryError("GEOMETRY_MESH_BOUNDS", "The constructed mesh exceeds its validated plate footprint.");
        }
        mesh.traverse((object) => {
          if (object instanceof Mesh) {
            const positions = object.geometry.getAttribute("position");
            for (const value of positions.array) if (!Number.isFinite(value)) throw new GeometryError("GEOMETRY_MESH_INVALID", "The constructed mesh contains invalid vertices.");
          }
        });
      } finally { disposeGeometryMesh(mesh); }
      return { status: "validated", geometry, warnings: [
        "Linear axes are laid out from the extracted values; manufacturing dimensions are not physical certification.",
        "Inspect a printed sample for tactile legibility before use.",
      ] };
    } catch (error) {
      return { status: "failed", error: { code: error instanceof GeometryError ? error.code : "GEOMETRY_GENERATION_FAILED",
        message: error instanceof GeometryError ? error.message : "This diagram could not be laid out safely. Its extracted data has been preserved." } };
    }
  }
}

export function generateGeometry(input: SupportedDiagramData, profile: PhysicalProfile, grade: 1 | 2): GeometryState {
  const parsed = diagramSchema.safeParse(input);
  if (!parsed.success || parsed.data.chart_type === "unsupported") throw new GeometryError("GEOMETRY_DATA_INVALID", "This chart lacks validated orientation or axis data. Analyze it again before geometry generation.");
  const data = parsed.data;
  const p = profileSchema.parse(profile);
  if (data.data_points.length > 100) fail("This diagram has too many labelled points to fit the v1 plate.");
  if (data.data_points.some((point) => point.value === null) || data.independent_axis.values.some((v) => v === null)) {
    throw new GeometryError("GEOMETRY_DATA_REVIEW_REQUIRED", "Resolve unreadable chart values before generating geometry; missing values cannot become zero.");
  }
  const horizontal = data.chart_type === "bar_chart" && data.orientation === "horizontal";
  const bars = data.chart_type === "bar_chart";
  const values = data.data_points.map((point) => point.value!);
  const independent = data.independent_axis.type === "numeric" ? data.independent_axis.values as number[] : values.map((_, i) => i);
  const domain: [number, number] = [independent[0], independent.at(-1)!];
  if (independent.length > 1 && independent.some((v, i) => i > 0 && (v - independent[i - 1]) * Math.sign(domain[1] - domain[0]) <= 0)) {
    throw new GeometryError("GEOMETRY_AXIS_UNSUPPORTED", "Numeric positions must be distinct and strictly ordered. Duplicate or non-monotonic axis values need review.");
  }
  let min = Math.min(0, ...values), max = Math.max(0, ...values);
  if (min === max) { min = 0; max = 1; } // Display range only; source zeros remain zero.
  if (!Number.isFinite(max - min) || !Number.isFinite(domain[1] - domain[0])) throw new GeometryError("GEOMETRY_RANGE_INVALID", "The chart's numeric range is too large to lay out safely.");
  const fractions = independent.map((v) => independent.length === 1 ? 0.5 : (v - domain[0]) / (domain[1] - domain[0]));
  const zero = (0 - min) / (max - min);
  let translation: ReturnType<typeof translateBraille> | undefined;
  const label = (id: string, text: string, anchor: string | null): LabelElement => {
    translation = translateBraille(text, grade);
    return { id, kind: "label", text, braille: translation.braille, x: 0, y: 0,
      ...brailleSize(translation.braille), anchor };
  };
  const independentTicks: Tick[] = data.independent_axis.values.map((value, i) => ({
    fraction: horizontal ? 1 - fractions[i] : fractions[i],
    label: label(`label-${horizontal ? "y" : "x"}-${i}`, String(value), horizontal ? "y-axis" : "x-axis"),
  }));
  const dependentValues = [...new Set([min, 0, max])].sort((a, b) => a - b);
  const dependentTicks = dependentValues.map((value, i) => ({ fraction: (value - min) / (max - min),
    label: label(`label-${horizontal ? "x" : "y"}-${i}`, String(value), horizontal ? "x-axis" : "y-axis") }));
  const xTicks = horizontal ? dependentTicks : independentTicks;
  const yTicks = horizontal ? independentTicks : dependentTicks;
  const barWidth = Math.max(A.barMinWidth, Math.min(A.barMaxWidth,
    Math.max(...independentTicks.map((tick) => horizontal ? tick.label.height : tick.label.width))));
  const extentX = horizontal ? 0 : bars ? barWidth / 2 : A.plottedPointMin / 2;
  const extentY = horizontal ? barWidth / 2 : bars ? 0 : A.plottedPointMin / 2;
  let width = Math.max(A.dataPathMin, spanForTicks(xTicks, "width"));
  let height = Math.max(A.dataPathMin, spanForTicks(yTicks, "height"));
  let independentSpan = horizontal ? height : width;
  for (let i = 1; i < fractions.length; i++) {
    independentSpan = Math.max(independentSpan, ((bars ? barWidth : A.plottedPointMin) + A.separation) / (fractions[i] - fractions[i - 1]));
  }
  let valueSpan = horizontal ? width : height;
  if (bars) for (const value of values) {
    if (value !== 0) valueSpan = Math.max(valueSpan, (A.areaMin / barWidth) / (Math.abs(value) / (max - min)));
  }
  if (horizontal) { height = independentSpan; width = valueSpan; }
  else { width = independentSpan; height = valueSpan; }
  const yAxisX = A.margin + Math.max(...yTicks.map((t) => t.label.width)) + A.labelClearance + p.axisWidth / 2;
  const xAxisY = A.margin + Math.max(...xTicks.map((t) => t.label.height)) + A.labelClearance + p.axisWidth / 2;
  const x = yAxisX + p.axisWidth / 2 + A.separation + extentX;
  const y = xAxisY + p.axisWidth / 2 + A.separation + extentY;
  if (x + width + extentX + A.margin > p.maxWidth || y + height + extentY + A.margin > p.maxHeight) {
    fail("This chart cannot fit the configured plate while preserving braille, bar area, spacing and numeric proportions. Simplify or split the source chart.");
  }
  const elements: GeometryElement[] = [];
  const line = (id: string, role: LineElement["role"], from: XY, to: XY): LineElement => ({
    id, kind: "line", role, segments: [{ from, to }], width: role === "axis" ? p.axisWidth : p.dataWidth,
    rise: role === "axis" ? p.axisRise : p.dataRise,
  });
  elements.push(line("x-axis", "axis", [yAxisX, xAxisY], [x + width + extentX, xAxisY]),
    line("y-axis", "axis", [yAxisX, xAxisY], [yAxisX, y + height + extentY]));
  for (const tick of xTicks) {
    tick.label.x = x + tick.fraction * width - tick.label.width / 2;
    tick.label.y = xAxisY - p.axisWidth / 2 - A.labelClearance - tick.label.height;
    elements.push(tick.label);
  }
  for (const tick of yTicks) {
    tick.label.x = yAxisX - p.axisWidth / 2 - A.labelClearance - tick.label.width;
    tick.label.y = y + tick.fraction * height - tick.label.height / 2;
    elements.push(tick.label);
  }
  const points: XY[] = [];
  values.forEach((value, i) => {
    const dependent = (value - min) / (max - min);
    const position: XY = horizontal ? [x + dependent * width, y + (1 - fractions[i]) * height]
      : [x + fractions[i] * width, y + dependent * height];
    if (bars) {
      const baseline = horizontal ? x + zero * width : y + zero * height;
      const bar: BarElement = { id: `bar-${i}`, kind: "bar", sourceIndex: i,
        orientation: horizontal ? "horizontal" : "vertical", texture: "stripes", rise: p.barRise,
        x: horizontal ? Math.min(baseline, position[0]) : position[0] - barWidth / 2,
        y: horizontal ? position[1] - barWidth / 2 : Math.min(baseline, position[1]),
        width: horizontal ? Math.abs(position[0] - baseline) : barWidth,
        height: horizontal ? barWidth : Math.abs(position[1] - baseline) };
      elements.push(bar);
    } else {
      points.push(position);
      elements.push({ id: `point-${i}`, kind: "point", sourceIndex: i, x: position[0], y: position[1], size: A.plottedPointMin, rise: p.pointRise });
    }
  });
  for (let i = 1; i < points.length; i++) elements.push(line(`data-segment-${i - 1}`, "data", points[i - 1], points[i]));

  // Grid dashes are additive fragments; clip by omitting whole dashes that would
  // violate blank space. Never cut a bar/point with a background ridge.
  const obstacles = elements.filter((e) => !(e.kind === "bar" && (e.width === 0 || e.height === 0)));
  dependentTicks.forEach((tick, index) => {
    const grid: LineElement = { id: `grid-${horizontal ? "x" : "y"}-${index}`, kind: "line", role: "grid",
      width: p.gridWidth, rise: p.gridRise, segments: [] };
    const start = horizontal ? y - extentY : x - extentX;
    const end = horizontal ? y + height + extentY : x + width + extentX;
    const fixed = horizontal ? x + tick.fraction * width : y + tick.fraction * height;
    for (let offset = start; offset + p.gridDash <= end; offset += p.gridDash + p.gridGap) {
      const segment = horizontal ? { from: [fixed, offset] as XY, to: [fixed, offset + p.gridDash] as XY }
        : { from: [offset, fixed] as XY, to: [offset + p.gridDash, fixed] as XY };
      const candidate = { ...grid, segments: [segment] };
      if (obstacles.every((other) => elementDistance(candidate, other) >= A.separation)) grid.segments.push(segment);
    }
    if (grid.segments.length) elements.push(grid);
  });
  let top = Math.max(...elements.map((e) => bounds(e).maxY));
  const headers = [["label-x-title", data.axis_labels.x ? `x: ${data.axis_labels.x}` : null],
    ["label-y-title", data.axis_labels.y ? `y: ${data.axis_labels.y}` : null], ["legend-0", data.series_label]];
  for (const [id, text] of headers) if (text?.trim()) {
    const header = label(id!, text, null);
    header.x = A.margin; header.y = top + A.separation;
    elements.push(header); top = header.y + header.height;
  }
  const plate = { width: Math.max(...elements.map((e) => bounds(e).maxX)) + A.margin,
    height: top + A.margin, thickness: p.baseThickness };
  if (plate.width > p.maxWidth || plate.height > p.maxHeight || elements.some((e) => bounds(e).minX < A.margin - 1e-7 || bounds(e).minY < A.margin - 1e-7)) {
    fail("The chart labels and required clearances do not fit this plate. Shorten labels or simplify the source; braille cannot be scaled down.");
  }
  const state: GeometryState = { version: 1, units: "mm", source: data, profile: p, plate,
    braille: { grade, table: translation!.table, version: translation!.version },
    mapping: { independent: domain, dependent: [min, max], x, y, width, height, horizontal }, elements };
  const issues = validateGeometry(state);
  if (issues.length) throw new GeometryError("GEOMETRY_VALIDATION_FAILED", `This layout does not satisfy the tactile profile: ${issues[0].message}`);
  return state;
}

function spanForTicks(ticks: Tick[], dimension: "width" | "height"): number {
  let result = 0;
  for (let i = 0; i < ticks.length; i++) for (let j = i + 1; j < ticks.length; j++) {
    const difference = Math.abs(ticks[i].fraction - ticks[j].fraction);
    if (!difference) fail("Two distinct labels occupy the same numeric axis position.");
    result = Math.max(result, ((ticks[i].label[dimension] + ticks[j].label[dimension]) / 2 + A.separation) / difference);
  }
  return result;
}
