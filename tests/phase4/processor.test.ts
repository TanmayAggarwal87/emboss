import assert from "node:assert/strict";
import test from "node:test";
import * as mupdf from "mupdf";
import { openPdf } from "../../src/lib/phase1/pdf.ts";
import { DiagramRegionProcessor } from "../../src/lib/phase4/diagram-processor.ts";
import { extractWithValidationRetries } from "../../src/lib/phase4/schema.ts";
import { CHART_BOX, EXPECTED_CHARTS, createDiagramFixture } from "./fixtures.ts";

test("MuPDF supplies only the bounded chart crop to extraction, with no text/OCR call", async (context) => {
  context.mock.method(globalThis, "fetch", () => { assert.fail("Offline test."); });
  const document = openPdf(createDiagramFixture());
  context.after(() => document.destroy());
  context.mock.method(document, "extractTextRegion", () => { assert.fail("Call B reads the crop, not text."); });
  let index = 0;
  const processor = new DiagramRegionProcessor({ async extract(png, attempts) {
    assert.equal(attempts, 3);
    const image = new mupdf.Image(png);
    try { assert.equal(image.getWidth(), 1840); assert.equal(image.getHeight(), 1840); }
    finally { image.destroy(); }
    return EXPECTED_CHARTS[index++];
  } });
  for (let page = 0; page < 2; page += 1) {
    const result = await processor.process(document, page, CHART_BOX, 3);
    assert.ok(result.status === "processed");
    assert.deepEqual(result.data, EXPECTED_CHARTS[page]);
    assert.equal(result.needs_data_review, false);
    assert.equal("geometry" in result, false);
  }
});

test("unreadable values stay null and are flagged for review, never converted to zero", async () => {
  const document = openPdf(createDiagramFixture());
  try {
    const processor = new DiagramRegionProcessor({ async extract() {
      return { ...EXPECTED_CHARTS[0], data_points: [{ label: "Jan", value: null }] };
    } });
    const result = await processor.process(document, 0, CHART_BOX, 3);
    assert.ok(result.status === "processed");
    assert.equal(result.data.data_points[0].value, null);
    assert.equal(result.needs_data_review, true);
    assert.match(result.warnings[0], /before geometry/);
  } finally { document.destroy(); }
});

test("null numeric independent-axis values are flagged for review", async () => {
  const document = openPdf(createDiagramFixture());
  try {
    const processor = new DiagramRegionProcessor({ async extract() {
      return { ...EXPECTED_CHARTS[0], independent_axis: { type: "numeric" as const, values: [1, null, 3] } };
    } });
    const result = await processor.process(document, 0, CHART_BOX, 1);
    assert.ok(result.status === "processed");
    assert.equal(result.needs_data_review, true);
  } finally { document.destroy(); }
});

test("bad crop, unsupported figure and validation exhaustion produce distinct per-region errors", async () => {
  const document = openPdf(createDiagramFixture());
  try {
    let calls = 0;
    const processor = new DiagramRegionProcessor({ async extract() { calls += 1; return { chart_type: "unsupported" }; } });
    const crop = await processor.process(document, 0, { ...CHART_BOX, width: 1000 }, 3);
    assert.ok(crop.status === "failed" && crop.error.code === "DIAGRAM_CROP_FAILED");
    assert.equal(calls, 0);
    const unsupported = await processor.process(document, 0, CHART_BOX, 3);
    assert.ok(unsupported.status === "failed" && unsupported.error.code === "DIAGRAM_UNSUPPORTED");
    assert.equal(calls, 1);
    const invalid = new DiagramRegionProcessor({ extract: (_png, attempts) =>
      extractWithValidationRetries(async () => '{"width_mm": 100}', attempts) });
    const failure = await invalid.process(document, 0, CHART_BOX, 3);
    assert.ok(failure.status === "failed" && failure.error.code === "DIAGRAM_VALIDATION_FAILED");
    assert.equal("data" in failure, false);
  } finally { document.destroy(); }
});
