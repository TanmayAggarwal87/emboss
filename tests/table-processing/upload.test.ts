import assert from "node:assert/strict";
import test from "node:test";

import { openPdf } from "../../src/lib/document-processing/pdf.ts";
import { UploadRateLimiter } from "../../src/lib/document-processing/rate-limit.ts";
import { createUploadHandler } from "../../src/lib/document-processing/upload-handler.ts";
import type { PersistedRegion } from "../../src/lib/document-processing/types.ts";
import { TextRegionProcessor } from "../../src/lib/text-processing/text-processor.ts";
import { TableRegionProcessor } from "../../src/lib/table-processing/table-processor.ts";
import { DiagramRegionProcessor } from "../../src/lib/diagram-extraction/diagram-processor.ts";
import { createTableFixture, TABLE_BOX, TABLE_HEADERS, TABLE_ROWS, type FixtureMode } from "./fixtures.ts";

test("upload persists table data, a per-region failure and diagram rerouting without model calls", async (context) => {
  context.mock.method(globalThis, "fetch", () => { assert.fail("No network/model request expected."); });
  const harness = createHarness(["ruled", "merged", "mixed_image"]);
  const response = await harness.run();
  assert.equal(response.status, 207);
  const body = await response.json();
  assert.equal(body.status, "processing");
  assert.equal(harness.calls(), 3, "One injected classification per page, no additional model calls.");
  assert.equal(harness.rows.length, 3);
  assert.deepEqual(harness.rows.map((row) => row.type), ["table", "table", "diagram"]);
  assert.ok(harness.rows.every((row) => row.review_status === "pending"));
  const good = harness.rows[0].extracted_data;
  assert.ok(good?.kind === "table" && good.status === "processed");
  assert.deepEqual(good.headers, TABLE_HEADERS);
  assert.deepEqual(good.rows, TABLE_ROWS);
  assert.equal(good.braille_pages.length, 1);
  const failed = harness.rows[1].extracted_data;
  assert.ok(failed?.status === "failed");
  assert.equal(failed.error.code, "TABLE_MERGED_CELLS");
  const diagram = harness.rows[2].extracted_data;
  assert.ok(diagram?.kind === "diagram" && diagram.status === "failed");
  assert.equal(diagram.error.code, "DIAGRAM_UNSUPPORTED");
  assert.equal(body.pages[1].table_processing, "partial_failure");
  assert.equal(body.pages[1].text_processing, "complete");
  assert.equal(harness.destroyed(), true);
  assert.equal(harness.failed.length, 0);
});

test("all failed tables fail the job without treating pending review as rejection", async () => {
  const harness = createHarness(["merged", "multi_header"]);
  assert.equal((await harness.run()).status, 422);
  assert.equal(harness.failed.length, 1);
  assert.ok(harness.rows.every((row) => row.review_status === "pending" && row.extracted_data?.status === "failed"));
});

function createHarness(modes: FixtureMode[]) {
  const rows: PersistedRegion[] = [];
  const failed: string[] = [];
  let calls = 0;
  let destroyed = false;
  const handler = createUploadHandler({
    config: { maxPdfPages: 3, maxUploadBytes: 7 * 1024 * 1024, uploadsPerIp: 5, maxGeminiValidationAttempts: 3 },
    rateLimiter: new UploadRateLimiter(),
    openPdf(bytes) {
      const document = openPdf(bytes);
      const destroy = document.destroy.bind(document);
      document.destroy = () => { destroyed = true; destroy(); };
      return document;
    },
    classifier: { async classify() {
      calls += 1;
      return [{ region_id: "table", type: "table", bounding_box: TABLE_BOX }];
    } },
    textProcessor: new TextRegionProcessor(2, { async recognize() { assert.fail("Table handling must never use text OCR."); } }),
    tableProcessor: new TableRegionProcessor(2),
    diagramProcessor: new DiagramRegionProcessor({ async extract() { return { chart_type: "unsupported" }; } }),
    repository: {
      async createJob() { return "fixture-job"; },
      async insertRegions(_job, page, regions) {
        const saved = regions.map((region, index) => ({ id: `${page}-${index}`, type: region.type,
          bounding_box: region.bounding_box, review_status: "pending" as const, extracted_data: region.extracted_data ?? null }));
        rows.push(...saved);
        return saved;
      },
      async markJobFailed(_id, message) { failed.push(message); },
    },
  });
  return { rows, failed, calls: () => calls, destroyed: () => destroyed, run() {
    const form = new FormData();
    form.set("file", new File([Uint8Array.from(createTableFixture(modes))], "tables.pdf", { type: "application/pdf" }));
    // Reserved domain for the in-memory Request, never an HTTP destination.
    return handler(new Request("https://emboss.test/api/upload", { method: "POST", body: form }));
  } };
}
