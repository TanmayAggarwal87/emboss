import assert from "node:assert/strict";
import test from "node:test";

import { openPdf } from "../../src/lib/document-processing/pdf.ts";
import { UploadRateLimiter } from "../../src/lib/document-processing/rate-limit.ts";
import { createUploadHandler } from "../../src/lib/document-processing/upload-handler.ts";
import type { ClassifiedRegion, PersistedRegion } from "../../src/lib/document-processing/types.ts";
import { TextRegionProcessor } from "../../src/lib/text-processing/text-processor.ts";
import { EXPECTED_CHARTS } from "../diagram-extraction/fixtures.ts";
import { createTextFixture, TEXT_BOX, REFERENCE_GRADE_2, REFERENCE_TEXT } from "./fixtures.ts";

const VALID_REGION: ClassifiedRegion = { region_id: "text", type: "text", bounding_box: TEXT_BOX };
const EMPTY_REGION: ClassifiedRegion = { region_id: "empty", type: "text", bounding_box: { x: 0, y: 0, width: 50, height: 50 } };
const DIAGRAM_REGION: ClassifiedRegion = { region_id: "diagram", type: "diagram", bounding_box: { x: 180, y: 680, width: 200, height: 210 } };

test("upload passes real text and braille to persistence with diagram processing injected", async () => {
  const harness = createHarness([VALID_REGION, DIAGRAM_REGION]);
  const response = await harness.run();
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.status, "processing");
  assert.equal(harness.classifications(), 2, "Only the two upstream classification calls are needed.");
  assert.equal(harness.rows.length, 4);
  for (const row of harness.rows) {
    assert.equal(row.review_status, "pending");
    if (row.type === "text") {
      assert.equal(row.extracted_data?.status, "processed");
      if (row.extracted_data?.status !== "processed" || row.extracted_data.kind !== "text") assert.fail("Missing text result.");
      assert.equal(row.extracted_data.plain_text, REFERENCE_TEXT);
      assert.equal(row.extracted_data.braille, REFERENCE_GRADE_2);
    } else {
      assert.equal(row.extracted_data?.kind, "diagram");
    }
  }
  assert.equal(harness.destroyed(), true);
});

test("failed text results are persisted individually and produce partial success", async () => {
  const harness = createHarness([EMPTY_REGION, VALID_REGION, DIAGRAM_REGION]);
  const response = await harness.run();
  assert.equal(response.status, 207);
  const body = await response.json();
  assert.equal(body.status, "processing");
  assert.equal(body.pages[0].text_processing, "partial_failure");
  assert.equal(body.pages[0].regions[0].extracted_data.error.code, "TEXT_REGION_EMPTY");
  assert.equal(body.pages[0].regions[1].extracted_data.status, "processed");
  assert.equal(harness.failures.length, 0);
});

test("a document with only failed text regions is marked failed", async () => {
  const harness = createHarness([EMPTY_REGION]);
  assert.equal((await harness.run()).status, 422);
  assert.equal(harness.rows.length, 2);
  assert.equal(harness.failures.length, 1);
  assert.equal(harness.destroyed(), true);
});

test("a page persistence failure is reported and does not prevent the next page", async () => {
  const harness = createHarness([VALID_REGION], true);
  const response = await harness.run();
  assert.equal(response.status, 207);
  const body = await response.json();
  assert.equal(body.pages[0].status, "failed");
  assert.equal(body.pages[1].regions[0].extracted_data.status, "processed");
  assert.equal(harness.rows.length, 1);
  assert.equal(harness.destroyed(), true);
});

function createHarness(classified: ClassifiedRegion[], failFirstSave = false) {
  let classificationCalls = 0;
  let destroyed = false;
  const rows: PersistedRegion[] = [];
  const failures: string[] = [];
  const handler = createUploadHandler({
    config: { maxPdfPages: 3, maxUploadBytes: 7 * 1024 * 1024, uploadsPerIp: 5, maxGeminiValidationAttempts: 3 },
    rateLimiter: new UploadRateLimiter(),
    openPdf(bytes) {
      const document = openPdf(bytes);
      return {
        pageCount: document.pageCount,
        rasterizePage: document.rasterizePage.bind(document),
        extractTextRegion: document.extractTextRegion.bind(document),
        rasterizeRegion: document.rasterizeRegion.bind(document),
        inspectTableRegion: document.inspectTableRegion.bind(document),
        destroy() { document.destroy(); destroyed = true; },
      };
    },
    classifier: { async classify() { classificationCalls += 1; return classified; } },
    textProcessor: new TextRegionProcessor(2, { async recognize() { assert.fail("Text fixture must never use OCR."); } }),
    tableProcessor: { process() { assert.fail("Phase 2 fixtures contain no tables."); } },
    diagramProcessor: { async process() { return { kind: "diagram", status: "processed", source: "gemini",
      data: EXPECTED_CHARTS[0], needs_data_review: false, warnings: [] }; } },
    repository: {
      async createJob() { return "test-job"; },
      async insertRegions(_jobId, pageNumber, regions) {
        if (failFirstSave && pageNumber === 1) throw new Error("Simulated database failure.");
        const persisted = regions.map((region, index) => ({ id: `${pageNumber}-${index}`, type: region.type,
          bounding_box: region.bounding_box, review_status: "pending" as const, extracted_data: region.extracted_data ?? null }));
        rows.push(...persisted);
        return persisted;
      },
      async markJobFailed(_id, message) { failures.push(message); },
    },
  });
  return {
    rows, failures, classifications: () => classificationCalls, destroyed: () => destroyed,
    run() {
      const form = new FormData();
      form.set("file", new File([Uint8Array.from(createTextFixture())], "fixture.pdf", { type: "application/pdf" }));
      // Reserved .test domain; Request is invoked in memory, never sent over HTTP.
      return handler(new Request("https://emboss.test/api/upload", { method: "POST", body: form }));
    },
  };
}
