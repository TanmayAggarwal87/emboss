import assert from "node:assert/strict";
import test from "node:test";
import { EXPECTED_CHARTS } from "../diagram-extraction/fixtures.ts";
import { generateGeometry } from "../../src/lib/tactile-geometry/generate.ts";
import { DEFAULT_PROFILE, type PhysicalProfile } from "../../src/lib/tactile-geometry/profile.ts";
import { DeterministicGeometryProcessor } from "../../src/lib/tactile-geometry/generate.ts";
import type { GeometryState } from "../../src/lib/tactile-geometry/types.ts";
import type { SupportedDiagramData } from "../../src/lib/diagram-extraction/schema.ts";

const bar = EXPECTED_CHARTS[0];
const line = EXPECTED_CHARTS[1];
const profile = DEFAULT_PROFILE;
const generated = (data: SupportedDiagramData, p: PhysicalProfile = profile) => generateGeometry(data, p, 1);

test("generates both supported fixture charts with stable source elements", () => {
  for (const data of [bar, line]) {
    const state = generated(data);
    assert.equal(state.units, "mm");
    assert.deepEqual(state.source, data);
    const source = state.elements.filter((e) => e.kind === "bar" || e.kind === "point");
    assert.equal(source.length, data.data_points.length);
    assert.deepEqual(source.map((e) => e.id), data.data_points.map((_, i) => `${data.chart_type === "bar_chart" ? "bar" : "point"}-${i}`));
  }
});

test("horizontal bars preserve descending numeric source order and proportional placement", () => {
  const data = { ...bar, orientation: "horizontal" as const,
    independent_axis: { type: "numeric" as const, values: [10, 4, -2] },
    data_points: [{ label: "A", value: 3 }, { label: "B", value: -4 }, { label: "C", value: 8 }] };
  const state = generated(data);
  assert.equal(state.mapping.horizontal, true);
  assert.deepEqual(state.mapping.independent, [10, -2]);
  const bars = state.elements.filter((e): e is Extract<GeometryState["elements"][number], { kind: "bar" }> => e.kind === "bar");
  assert.ok(bars[0].y > bars[1].y && bars[1].y > bars[2].y);
  assert.ok(bars[0].width !== bars[1].width && bars[1].width !== bars[2].width);
});

test("numeric independent positions are proportional and negative/zero values keep sign", () => {
  const data = { ...bar, independent_axis: { type: "numeric" as const, values: [0, 2, 10] },
    data_points: [{ label: "zero", value: 0 }, { label: "negative", value: -5 }, { label: "positive", value: 10 }] };
  const state = generated(data);
  const bars = state.elements.filter((e) => e.kind === "bar");
  assert.equal(bars.length, 3);
  assert.equal(bars[0].height, 0);
  assert.ok(bars[1].y < bars[0].y);
  assert.equal(bars[2].y, bars[0].y);
  assert.ok(bars[2].height > 0);
  const centres = bars.map((entry) => entry.x + entry.width / 2);
  assert.ok(Math.abs((centres[1] - centres[0]) / (centres[2] - centres[0]) - 0.2) < 1e-9);
  assert.ok(Math.abs(bars[1].height / bars[2].height - 0.5) < 1e-9);
});

test("braille dimensions remain fixed across chart densities", () => {
  const sparse = generated(bar);
  const dense = generated({ ...line, data_points: Array.from({ length: 4 }, (_, i) => ({ label: `L${i}`, value: i + 1 })),
    independent_axis: { type: "categorical" as const, values: Array.from({ length: 4 }, (_, i) => `L${i}`) } });
  const dimensions = (s: GeometryState) => s.elements.filter((e) => e.kind === "label").map((e) => [e.text, e.width, e.height]);
  for (const [text, width, height] of dimensions(sparse)) {
    const match = dimensions(dense).find((d) => d[0] === text);
    if (match) assert.deepEqual([match[1], match[2]], [width, height]);
  }
});

test("processor rejects null source values and preserves an explicit failure", () => {
  const result = new DeterministicGeometryProcessor(profile, 1).process({ ...bar,
    data_points: [{ label: "Jan", value: null }, ...bar.data_points.slice(1)] });
  assert.equal(result.status, "failed");
  if (result.status === "failed") assert.equal(result.error.code, "GEOMETRY_DATA_REVIEW_REQUIRED");
});

test("overdense, impossible-range, and long-label inputs fail clearly", () => {
  const tooMany = { ...bar, data_points: Array.from({ length: 40 }, (_, i) => ({ label: `v${i}`, value: i + 1 })),
    independent_axis: { type: "categorical" as const, values: Array.from({ length: 40 }, (_, i) => `v${i}`) } };
  assert.equal(new DeterministicGeometryProcessor(profile, 1).process(tooMany).status, "failed");
  const huge = { ...bar, data_points: [{ label: "a", value: Number.MAX_VALUE }, { label: "b", value: -Number.MAX_VALUE }], independent_axis: { type: "categorical" as const, values: ["a", "b"] } };
  assert.equal(new DeterministicGeometryProcessor(profile, 1).process(huge).status, "failed");
  const long = { ...bar, axis_labels: { x: "x".repeat(2000), y: "y" }, independent_axis: { type: "categorical" as const, values: ["Jan", "Feb", "Mar"] } };
  const result = new DeterministicGeometryProcessor(profile, 1).process(long);
  assert.equal(result.status, "failed");
  if (result.status === "failed") assert.match(result.error.message, /fit|label/i);
});

test("custom plate profile fits without overflow and rejects a smaller impossible footprint", () => {
  const compact = { ...profile, maxWidth: 120, maxHeight: 120 };
  const result = new DeterministicGeometryProcessor(compact, 1).process(bar);
  assert.equal(result.status, "validated");
  if (result.status === "validated") {
    assert.ok(result.geometry.plate.width <= 120 && result.geometry.plate.height <= 120);
  }
  const small = new DeterministicGeometryProcessor({ ...profile, maxWidth: 50, maxHeight: 50 }, 1).process(bar);
  assert.equal(small.status, "failed");
  if (small.status === "failed") assert.match(small.error.message, /fit|plate|dense/i);
});
