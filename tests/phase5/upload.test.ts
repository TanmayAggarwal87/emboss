import assert from "node:assert/strict";
import test from "node:test";
import { openPdf } from "../../src/lib/phase1/pdf.ts";
import { UploadRateLimiter } from "../../src/lib/phase1/rate-limit.ts";
import { RetrySessionStore } from "../../src/lib/phase1/retry-sessions.ts";
import { createRetryHandler, createUploadHandler, type UploadDependencies } from "../../src/lib/phase1/upload-handler.ts";
import type { ClassifiedRegion, JobRepository, PersistedRegion } from "../../src/lib/phase1/types.ts";
import type { TextRegionResult } from "../../src/lib/phase2/types.ts";
import { TableRegionProcessor } from "../../src/lib/phase3/table-processor.ts";
import { DiagramRegionProcessor } from "../../src/lib/phase4/diagram-processor.ts";
import type { DiagramExtractor } from "../../src/lib/phase4/types.ts";
import { DeterministicGeometryProcessor } from "../../src/lib/phase5/generate.ts";
import { DEFAULT_PROFILE } from "../../src/lib/phase5/profile.ts";
import type { GeometryProcessor } from "../../src/lib/phase5/types.ts";
import { CHART_BOX, EXPECTED_CHARTS, createDiagramFixture } from "../phase4/fixtures.ts";

const TEXT_BOX = { x: 40, y: 40, width: 300, height: 80 };
const CONFIG = { maxPdfPages: 3, maxUploadBytes: 7 * 1024 * 1024, uploadsPerIp: 5, maxGeminiValidationAttempts: 3 };

test("mixed text and diagrams persist extracted data and validated geometry, then mark all pages ready", async () => {
  const harness = makeHarness({ regions: (page) => page === 1
    ? [{ region_id: "intro", type: "text", bounding_box: TEXT_BOX }, diagram("bar")]
    : [diagram("line")] });
  const response = await harness.upload();
  assert.equal(response.status, 201);
  const body = await response.json() as { status: string; pages: Array<{ geometry_processing?: string }> };
  assert.equal(body.status, "ready_for_review");
  assert.deepEqual(body.pages.map((page) => page.geometry_processing), ["complete", "complete"]);
  assert.equal(harness.ready, "00000000-0000-4000-8000-000000000001");
  assert.equal(harness.failed.length, 0);
  assert.equal(harness.rows.length, 3);
  const text = harness.rows.find((row) => row.type === "text");
  assert.equal(text?.extracted_data?.kind, "text");
  const charts = harness.rows.filter((row) => row.type === "diagram");
  assert.equal(charts.length, 2);
  assert.ok(charts.every((row) => row.geometry && row.extracted_data?.kind === "diagram" && row.extracted_data.status === "processed"));
  assert.deepEqual(charts.map((row) => row.geometry?.source.chart_type), ["bar_chart", "line_graph_single_series"]);
});

test("a geometry failure preserves the extracted diagram and successful regions", async () => {
  const harness = makeHarness({ regions: () => [diagram("bad"), diagram("good")], geometry: {
    process(data) { return data === EXPECTED_CHARTS[0] ? { status: "failed", error: { code: "FIXTURE_DENSE", message: "fixture is too dense" } } : new DeterministicGeometryProcessor(DEFAULT_PROFILE, 1).process(data); },
  } });
  const response = await harness.upload();
  assert.equal(response.status, 207);
  const bad = harness.rows[0];
  assert.equal(bad?.geometry, null);
  assert.equal(bad?.extracted_data?.kind, "diagram");
  assert.equal(bad?.extracted_data?.status, "processed");
  if (bad?.extracted_data?.kind === "diagram" && bad.extracted_data.status === "processed") {
    assert.deepEqual(bad.extracted_data.geometry_processing, { status: "failed", error: { code: "FIXTURE_DENSE", message: "fixture is too dense" } });
  }
  assert.ok(harness.rows.some((row) => row.geometry));
  assert.equal(harness.ready, undefined);
  assert.equal(harness.failed.length, 0);
});

test("all geometry failures fail the job without fabricating geometry", async () => {
  const harness = makeHarness({ regions: () => [diagram("a"), diagram("b")], geometry: failingGeometry() });
  const response = await harness.upload();
  assert.equal(response.status, 422);
  assert.equal((await response.json()).status, "failed");
  assert.equal(harness.failed.length, 1);
  assert.ok(harness.rows.every((row) => row.geometry === null));
  assert.ok(harness.rows.every((row) => row.extracted_data?.kind === "diagram" && row.extracted_data.status === "processed"));
});

test("null chart values produce a review-required geometry failure, never a zero bar", async () => {
  const data = { ...EXPECTED_CHARTS[0], data_points: [{ label: "Jan", value: null }, ...EXPECTED_CHARTS[0].data_points.slice(1)] };
  const harness = makeHarness({ extract: async () => data });
  const response = await harness.upload();
  assert.equal(response.status, 422);
  const row = harness.rows[0];
  assert.equal(row.geometry, null);
  assert.equal(row.extracted_data?.kind, "diagram");
  if (row.extracted_data?.kind === "diagram" && row.extracted_data.status === "processed") {
    assert.equal(row.extracted_data.needs_data_review, true);
    assert.equal(row.extracted_data.geometry_processing?.status, "failed");
    if (row.extracted_data.geometry_processing?.status === "failed") assert.equal(row.extracted_data.geometry_processing.error.code, "GEOMETRY_DATA_REVIEW_REQUIRED");
  }
});

test("retry reprocesses only the failed page and preserves the successful page geometry", async () => {
  let now = 100_000;
  let firstPageAttempts = 0;
  const sessions = new RetrySessionStore({ now: () => now });
  const harness = makeHarness({ sessions, regions: (page) => {
    if (page === 1 && firstPageAttempts++ === 0) throw new Error("temporary classifier failure");
    return [diagram(page === 1 ? "bar" : "line")];
  } });
  const first = await harness.upload();
  assert.equal(first.status, 207);
  const firstBody = await first.json() as { job_id: string; pages: Array<{ status: string }> };
  assert.equal(firstBody.pages[0].status, "failed");
  assert.equal(firstBody.pages[1].status, "classified");
  const preserved = harness.rows.find((row) => row.id === "2-line")?.geometry;
  assert.ok(preserved);
  now += 61_000;
  const retry = await harness.retry(firstBody.job_id, [1]);
  assert.equal(retry.status, 200);
  const retryBody = await retry.json() as { status: string; pages: Array<{ status: string }> };
  assert.equal(retryBody.status, "ready_for_review");
  assert.deepEqual(retryBody.pages.map((page) => page.status), ["classified", "classified"]);
  assert.equal(harness.rows.length, 2, "retry is an idempotent upsert by page and region");
  assert.deepEqual(harness.rows.find((row) => row.id === "2-line")?.geometry, preserved);
  assert.ok(harness.rows.every((row) => row.geometry));
});

function diagram(region_id: string): ClassifiedRegion { return { region_id, type: "diagram", bounding_box: CHART_BOX }; }

function failingGeometry(): GeometryProcessor { return { process: () => ({ status: "failed", error: { code: "FIXTURE_FAILURE", message: "fixture geometry failed" } }) }; }

function textResult(): TextRegionResult { return { kind: "text", status: "processed", source: "text_layer", plain_text: "Accessible text", braille: "⠠⠁⠉⠉⠑⠎⠎⠊⠃⠇⠑", braille_grade: 1, braille_code: "UEB", translation_table: "en-ueb-g1.ctb", liblouis_version: "fixture", ocr_confidence: null, warnings: [] }; }

function makeHarness(options: {
  regions?: (page: number) => ClassifiedRegion[];
  extract?: DiagramExtractor["extract"];
  geometry?: GeometryProcessor;
  sessions?: RetrySessionStore;
}) {
  const rows: PersistedRegion[] = [];
  const failed: string[] = [];
  let ready: string | undefined;
  const repository: JobRepository = {
    async createJob() { return "00000000-0000-4000-8000-000000000001"; },
    async insertRegions(_job, page, regions) {
      for (const region of regions) {
        const id = `${page}-${region.region_id}`;
        const saved: PersistedRegion = { id, type: region.type, bounding_box: region.bounding_box, review_status: "pending", extracted_data: region.extracted_data ?? null, geometry: region.geometry ?? null };
        const index = rows.findIndex((row) => row.id === id);
        if (index >= 0) rows[index] = saved; else rows.push(saved);
      }
      return regions.map((region) => rows.find((row) => row.id === `${page}-${region.region_id}`)!);
    },
    async markJobFailed(_job, message) { failed.push(message); },
    async markJobReady(job) { ready = job; },
  };
  const extractor: DiagramExtractor = { async extract(png, attempts) { return options.extract ? options.extract(png, attempts) : (extractorCalls++ % 2 === 0 ? EXPECTED_CHARTS[0] : EXPECTED_CHARTS[1]); } };
  let extractorCalls = 0;
  const dependencies: UploadDependencies = {
    config: CONFIG, rateLimiter: new UploadRateLimiter(), sessions: options.sessions,
    openPdf, classifier: { async classify(page) { return options.regions?.(page.pageNumber) ?? [diagram("chart")]; } },
    textProcessor: { async process() { return textResult(); } }, tableProcessor: new TableRegionProcessor(1),
    diagramProcessor: new DiagramRegionProcessor(extractor), geometryProcessor: options.geometry ?? new DeterministicGeometryProcessor(DEFAULT_PROFILE, 1), repository,
  };
  const upload = createUploadHandler(dependencies);
  const retry = createRetryHandler({ ...dependencies, sessions: options.sessions ?? new RetrySessionStore() });
  return { rows, failed, get ready() { return ready; }, upload: () => upload(request()), retry: (job: string, pages: number[]) => retry(new Request("https://emboss.test/api/retry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pages }) }), job) };
}

function request(): Request {
  const form = new FormData(); form.set("file", new File([new Uint8Array(createDiagramFixture())], "charts.pdf", { type: "application/pdf" }));
  return new Request("https://emboss.test/api/upload", { method: "POST", body: form });
}
