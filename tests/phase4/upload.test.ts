import assert from "node:assert/strict";
import test from "node:test";
import { openPdf } from "../../src/lib/phase1/pdf.ts";
import { UploadRateLimiter } from "../../src/lib/phase1/rate-limit.ts";
import { createUploadHandler } from "../../src/lib/phase1/upload-handler.ts";
import type { ClassifiedRegion, PersistedRegion } from "../../src/lib/phase1/types.ts";
import { TableRegionProcessor } from "../../src/lib/phase3/table-processor.ts";
import { DiagramRegionProcessor } from "../../src/lib/phase4/diagram-processor.ts";
import { extractWithValidationRetries } from "../../src/lib/phase4/schema.ts";
import type { DiagramExtractor } from "../../src/lib/phase4/types.ts";
import { createTableFixture, TABLE_BOX } from "../phase3/fixtures.ts";
import { CHART_BOX, EXPECTED_CHARTS, createDiagramFixture } from "./fixtures.ts";

test("one invalid diagram exhausts its limit while same-page and later-page regions persist", async (context) => {
  context.mock.method(globalThis, "fetch", () => { assert.fail("Offline test."); });
  let calls = 0;
  const harness = createHarness({ extract: (_png, attempts) => extractWithValidationRetries(async () => {
    calls += 1;
    return calls <= 3 ? '{"geometry":[]}' : JSON.stringify(EXPECTED_CHARTS[0]);
  }, attempts) }, [diagram("a"), diagram("b")]);
  const response = await harness.run();
  assert.equal(response.status, 207);
  const body = await response.json();
  assert.equal(body.status, "processing");
  assert.equal(body.pages[0].diagram_processing, "partial_failure");
  assert.equal(body.pages[1].diagram_processing, "complete");
  assert.equal(body.pages[0].text_processing, "complete");
  assert.equal(calls, 6, "3 failed attempts followed by one for each of 3 good regions.");
  assert.equal(harness.rows.length, 4);
  assert.deepEqual(harness.rows.map((row) => row.extracted_data?.status), ["failed", "processed", "processed", "processed"]);
  assert.ok(harness.rows.every((row) => row.review_status === "pending"));
  assert.equal(harness.destroyed(), true);
  assert.equal(harness.failed.length, 0);
});

test("all unsupported regions fail the job, but null-valued charts remain reviewable data", async () => {
  const unsupported = createHarness({ async extract() { return { chart_type: "unsupported" }; } });
  assert.equal((await unsupported.run()).status, 422);
  assert.equal(unsupported.failed.length, 1);
  assert.ok(unsupported.rows.every((row) => row.extracted_data?.status === "failed"));
  const unreadable = createHarness({ async extract() {
    return { ...EXPECTED_CHARTS[0], data_points: [{ label: "Jan", value: null }] };
  } });
  const response = await unreadable.run();
  assert.equal(response.status, 201);
  assert.equal((await response.json()).status, "processing", "No ready_for_review before geometry exists.");
  assert.ok(unreadable.rows.every((row) => row.extracted_data?.kind === "diagram" &&
    row.extracted_data.status === "processed" && row.extracted_data.needs_data_review));
});

test("real image tables are routed through Call B, while real text tables make no extraction calls", async () => {
  let calls = 0;
  const harness = createHarness({ async extract() { calls += 1; return { chart_type: "unsupported" }; } },
    [{ region_id: "table", type: "table", bounding_box: TABLE_BOX }], createTableFixture(["ruled", "mixed_image"]));
  assert.equal((await harness.run()).status, 207);
  assert.equal(calls, 1);
  assert.deepEqual(harness.rows.map((row) => row.type), ["table", "diagram"]);
  const routed = harness.rows[1].extracted_data;
  assert.ok(routed?.status === "failed" && routed.error.code === "DIAGRAM_UNSUPPORTED");
  assert.deepEqual(harness.rows[1].bounding_box, TABLE_BOX);
});

function diagram(id: string): ClassifiedRegion {
  return { region_id: id, type: "diagram", bounding_box: CHART_BOX };
}

function createHarness(extractor: DiagramExtractor, regions = [diagram("chart")], bytes = createDiagramFixture()) {
  const rows: PersistedRegion[] = [];
  const failed: string[] = [];
  let destroyed = false;
  const handler = createUploadHandler({
    config: { maxPdfPages: 3, maxUploadBytes: 7 * 1024 * 1024, uploadsPerIp: 5, maxGeminiValidationAttempts: 3 },
    rateLimiter: new UploadRateLimiter(),
    openPdf(input) {
      const document = openPdf(input);
      const destroy = document.destroy.bind(document);
      document.destroy = () => { destroyed = true; destroy(); };
      return document;
    },
    classifier: { async classify() { return regions; } },
    textProcessor: { async process() { assert.fail("No text region in this fixture."); } },
    tableProcessor: new TableRegionProcessor(2),
    diagramProcessor: new DiagramRegionProcessor(extractor),
    repository: {
      async createJob() { return "fixture-job"; },
      async insertRegions(_job, page, input) {
        const saved = input.map((region, index) => ({ id: `${page}-${index}`, type: region.type,
          bounding_box: region.bounding_box, review_status: "pending" as const, extracted_data: region.extracted_data ?? null }));
        rows.push(...saved);
        return saved;
      },
      async markJobFailed(_job, message) { failed.push(message); },
    },
  });
  return { rows, failed, destroyed: () => destroyed, run() {
    const form = new FormData();
    form.set("file", new File([Uint8Array.from(bytes)], "charts.pdf", { type: "application/pdf" }));
    return handler(new Request("https://emboss.test/api/upload", { method: "POST", body: form }));
  } };
}
