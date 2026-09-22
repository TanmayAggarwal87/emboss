import assert from "node:assert/strict";
import test from "node:test";

import { openPdf } from "../../src/lib/document-processing/pdf.ts";
import { TableRegionProcessor } from "../../src/lib/table-processing/table-processor.ts";
import { extractTable } from "../../src/lib/table-processing/extract-table.ts";
import { createTableFixture, TABLE_BOX, TABLE_HEADERS, TABLE_ROWS, type FixtureMode } from "./fixtures.ts";

test("extracts real ruled PDF cells including a genuine empty cell", () => {
  for (const mode of ["ruled", "filled_rules"] as const) {
    const pdf = openPdf(createTableFixture([mode, mode]));
    try {
      assert.deepEqual(extractTable(pdf.inspectTableRegion(0, TABLE_BOX)),
        { headers: TABLE_HEADERS, rows: TABLE_ROWS, structure: "ruled" });
    } finally { pdf.destroy(); }
  }
});

test("extracts consistently aligned, unruled text columns", () => {
  const pdf = openPdf(createTableFixture(["aligned", "aligned"]));
  try {
    const table = extractTable(pdf.inspectTableRegion(0, TABLE_BOX));
    assert.equal(table.structure, "aligned");
    assert.deepEqual(table.headers, TABLE_HEADERS);
    assert.deepEqual(table.rows, [["Amy", "2"], ["Bob", "3"], ["Christopher", "12"]]);
  } finally { pdf.destroy(); }
});

test("rejects merged, multiple-header, stem-and-leaf and perimeter-less layouts", () => {
  const expected: [FixtureMode, string][] = [["merged", "TABLE_MERGED_CELLS"],
    ["multi_header", "TABLE_MULTIPLE_HEADERS"], ["stem_leaf", "TABLE_UNSUPPORTED_CONTENT"],
    ["punnett", "TABLE_GRID_UNSUPPORTED"]];
  for (const [mode, code] of expected) {
    const pdf = openPdf(createTableFixture([mode, mode]));
    try {
      const result = new TableRegionProcessor(2).process(pdf, 0, TABLE_BOX);
      assert.equal(result.extracted_data?.status, "failed", `${mode}: ${JSON.stringify(result)}`);
      if (result.extracted_data?.status !== "failed") assert.fail(mode);
      assert.equal(result.extracted_data.error.code, code);
    } finally { pdf.destroy(); }
  }
});

test("routes image tables on scanned and mixed text/image pages to diagram without Gemini or OCR", (context) => {
  context.mock.method(globalThis, "fetch", () => { assert.fail("No network is allowed."); });
  for (const mode of ["image", "mixed_image"] as const) {
    const pdf = openPdf(createTableFixture([mode, mode]));
    try {
      assert.equal(pdf.rasterizePage(0).hasTextLayer, mode === "mixed_image");
      assert.deepEqual(new TableRegionProcessor(2).process(pdf, 0, TABLE_BOX), { type: "diagram", extracted_data: null });
    } finally { pdf.destroy(); }
  }
});

test("rejects clipped text boxes rather than silently losing cells", () => {
  const pdf = openPdf(createTableFixture());
  try {
    const result = new TableRegionProcessor(1).process(pdf, 0, { ...TABLE_BOX, x: 212, width: 600 });
    assert.equal(result.extracted_data?.status, "failed");
    if (result.extracted_data?.status !== "failed") assert.fail("Expected a clipped table rejection.");
    assert.equal(result.extracted_data.error.code, "TABLE_CLIPPED");
    assert.throws(() => pdf.inspectTableRegion(0, { ...TABLE_BOX, x: -1 }), /outside/);
  } finally { pdf.destroy(); }
});

test("unruled empty/merged cells are rejected as ambiguous", () => {
  const pdf = openPdf(createTableFixture());
  try {
    const evidence = pdf.inspectTableRegion(0, TABLE_BOX);
    assert.throws(() => extractTable({ ...evidence, horizontal: [], vertical: [] }), /ambiguous/);
  } finally { pdf.destroy(); }
});
