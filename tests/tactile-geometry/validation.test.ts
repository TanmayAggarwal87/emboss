import assert from "node:assert/strict";
import test from "node:test";
import { EXPECTED_CHARTS } from "../diagram-extraction/fixtures.ts";
import { generateGeometry } from "../../src/lib/tactile-geometry/generate.ts";
import { DEFAULT_PROFILE } from "../../src/lib/tactile-geometry/profile.ts";
import { validateGeometry } from "../../src/lib/tactile-geometry/validate.ts";
import type { GeometryState } from "../../src/lib/tactile-geometry/types.ts";

const base = generateGeometry(EXPECTED_CHARTS[0], DEFAULT_PROFILE, 1);
const corrupted = (edit: (state: GeometryState) => void): GeometryState => {
  const state = structuredClone(base) as GeometryState;
  edit(state);
  return state;
};
const codes = (state: unknown) => validateGeometry(state).map((issue) => issue.code);

test("validator rejects duplicate IDs and malformed source/geometry state", () => {
  const duplicate = corrupted((s) => { s.elements[1].id = s.elements[0].id; });
  assert.ok(codes(duplicate).includes("DUPLICATE_ID"));
  const missing = corrupted((s) => { s.elements = s.elements.filter((e) => e.kind !== "bar"); });
  assert.ok(codes(missing).includes("DATA_COUNT"));
  const moved = corrupted((s) => { const b = s.elements.find((e) => e.id === "bar-1"); if (b?.kind === "bar") b.x += 1; });
  assert.ok(codes(moved).includes("BAR_PROPORTION"));
  const nonfinite = corrupted((s) => { const b = s.elements.find((e) => e.id === "bar-0"); if (b?.kind === "bar") b.x = Number.NaN; });
  assert.ok(codes(nonfinite).includes("GEOMETRY_SCHEMA_INVALID"));
});

test("validator catches tactile profile and label violations", () => {
  const width = corrupted((s) => { const l = s.elements.find((e) => e.kind === "label"); if (l?.kind === "label") l.width += 1; });
  assert.ok(codes(width).includes("BRAILLE_SCALE"));
  const point = generateGeometry(EXPECTED_CHARTS[1], DEFAULT_PROFILE, 1);
  const smallPoint = structuredClone(point) as GeometryState;
  const p = smallPoint.elements.find((e) => e.kind === "point");
  if (p?.kind === "point") p.size = 1;
  assert.ok(codes(smallPoint).includes("POINT_SIZE"));
  const line = structuredClone(point) as GeometryState;
  const dataLine = line.elements.find((e) => e.kind === "line" && e.role === "data");
  if (dataLine?.kind === "line") { dataLine.width = 0.1; dataLine.rise = 0.1; }
  assert.ok(codes(line).includes("LINE_PROFILE"));
  const intersect = corrupted((s) => { const l = s.elements.find((e) => e.kind === "label"); if (l?.kind === "label") { l.x = 0; l.y = 0; } });
  assert.ok(codes(intersect).some((code) => ["MARGIN", "ELEMENT_SEPARATION"].includes(code)));
});

test("validator catches bars, grid styles, and plate margin corruption", () => {
  const narrow = corrupted((s) => { const b = s.elements.find((e) => e.kind === "bar"); if (b?.kind === "bar") b.width = 1; });
  assert.ok(codes(narrow).includes("BAR_WIDTH"));
  const grid = corrupted((s) => { const g = s.elements.find((e) => e.kind === "line" && e.role === "grid"); if (g?.kind === "line") g.segments[0].to[0] += 1; });
  assert.ok(codes(grid).includes("GRID_PATTERN"));
  const margin = corrupted((s) => { s.plate.width += 100; });
  assert.ok(codes(margin).includes("PLATE_PROFILE"));
  const outside = corrupted((s) => { const b = s.elements.find((e) => e.kind === "bar"); if (b?.kind === "bar") b.x = 0; });
  assert.ok(codes(outside).includes("MARGIN"));
});

test("validator rejects unsupported old source contracts and orientation mismatches", () => {
  const old = structuredClone(base) as unknown as Record<string, unknown>;
  const source = old.source as Record<string, unknown>;
  delete source.independent_axis;
  assert.ok(codes(old).includes("GEOMETRY_SCHEMA_INVALID"));
  const wrong = corrupted((s) => { s.mapping.horizontal = true; });
  assert.ok(codes(wrong).includes("ORIENTATION"));
});

test("validator rejects removed/moved axis labels and incorrect numeric placement", () => {
  assert.ok(codes(corrupted((s) => { s.elements = s.elements.filter((e) => e.id !== "label-x-1"); })).includes("AXIS_LABEL"));
  assert.ok(codes(corrupted((s) => { const e = s.elements.find((e) => e.id === "label-x-0"); if (e?.kind === "label") e.text = "invented"; })).includes("AXIS_LABEL"));
  const data = { ...EXPECTED_CHARTS[1], independent_axis: { type: "numeric" as const, values: [0, 2, 10] } };
  const state = generateGeometry(data, DEFAULT_PROFILE, 1);
  const point = state.elements.find((e) => e.id === "point-1");
  assert.ok(point?.kind === "point");
  point.x += 1;
  assert.ok(codes(state).includes("DATA_POSITION"));
});
