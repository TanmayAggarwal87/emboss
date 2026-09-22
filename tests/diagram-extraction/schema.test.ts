import assert from "node:assert/strict";
import test from "node:test";
import { parseDiagramResponse, extractWithValidationRetries } from "../../src/lib/diagram-extraction/schema.ts";
import { EXPECTED_CHARTS } from "./fixtures.ts";

test("accepts both supported charts, preserves labels/order/negative values and nullable data", () => {
  for (const chart of EXPECTED_CHARTS) assert.deepEqual(parseDiagramResponse(JSON.stringify(chart)), chart);
  const chart = { ...EXPECTED_CHARTS[0], axis_labels: { x: null, y: "Rainfall (mm)" },
    independent_axis: { type: "categorical" as const, values: ["A", "B"] },
    data_points: [{ label: "  Source label  ", value: -2.5 }, { label: "Unknown", value: null }] };
  assert.deepEqual(parseDiagramResponse(JSON.stringify(chart)), chart);
  assert.deepEqual(parseDiagramResponse('{"chart_type":"unsupported"}'), { chart_type: "unsupported" });
});

test("rejects unknown chart types, all extra fields, invalid numbers and missing structure", () => {
  const good = EXPECTED_CHARTS[0];
  for (const value of [
    { ...good, geometry: [] }, { ...good, width_mm: 50 },
    { ...good, axis_labels: { x: "Month", y: "Count", x_position: 3 } },
    { ...good, data_points: [{ label: "Jan", value: 3, height: 5 }] },
    { ...good, data_points: [{ label: "Jan", value: "3" }] },
    { ...good, data_points: [{ label: " ", value: 3 }] },
    { ...good, data_points: [] }, { ...good, chart_type: "pie_chart" },
    { ...good, chart_type: "line_graph_multi_series" },
    { ...EXPECTED_CHARTS[1], data_points: [{ label: "Jan", value: 1 }] },
    { chart_type: "unsupported", data_points: [] }, { chart_type: "bar_chart" },
  ]) assert.throws(() => parseDiagramResponse(JSON.stringify(value)));
  assert.throws(() => parseDiagramResponse(JSON.stringify(good).replace('"value":10', '"value":1e999')));
  assert.throws(() => parseDiagramResponse("```json\n{}\n```"));
});

test("validation retries have an exact total limit and return only a validated result", async () => {
  let calls = 0;
  assert.deepEqual(await extractWithValidationRetries(async () => {
    calls += 1;
    return calls < 3 ? '{"geometry":[]}' : JSON.stringify(EXPECTED_CHARTS[0]);
  }, 3), EXPECTED_CHARTS[0]);
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(extractWithValidationRetries(async () => { calls += 1; return "bad JSON"; }, 3), /after 3/);
  assert.equal(calls, 3);
});

test("unsupported/null results and transport failures do not trigger validation retries", async () => {
  for (const value of [{ chart_type: "unsupported" }, { ...EXPECTED_CHARTS[0],
    independent_axis: { type: "categorical" as const, values: ["Jan"] },
    data_points: [{ label: "Jan", value: null }] }]) {
    let calls = 0;
    await extractWithValidationRetries(async () => { calls += 1; return JSON.stringify(value); }, 3);
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(extractWithValidationRetries(async () => { calls += 1; throw new Error("503"); }, 3), /503/);
  assert.equal(calls, 1);
});

test("accepts horizontal bars and uneven numeric independent-axis values", () => {
  const horizontal = { ...EXPECTED_CHARTS[0], orientation: "horizontal" as const,
    independent_axis: { type: "numeric" as const, values: [1.5, 9.25, -2] } };
  assert.deepEqual(parseDiagramResponse(JSON.stringify(horizontal)), horizontal);
});

test("flags null numeric independent-axis values for review in the processor contract", () => {
  const chart = { ...EXPECTED_CHARTS[0], independent_axis: { type: "numeric" as const, values: [1, null, 3] } };
  assert.deepEqual(parseDiagramResponse(JSON.stringify(chart)), chart);
});

test("rejects mixed axis values, length mismatches, and geometry fields", () => {
  const good = EXPECTED_CHARTS[0];
  assert.throws(() => parseDiagramResponse(JSON.stringify({ ...good,
    independent_axis: { type: "categorical", values: ["Jan", 2, "Mar"] } })));
  assert.throws(() => parseDiagramResponse(JSON.stringify({ ...good,
    independent_axis: { type: "numeric", values: [1, 2] } })));
  assert.throws(() => parseDiagramResponse(JSON.stringify({ ...good, geometry: [] })));
});
