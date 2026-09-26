import assert from "node:assert/strict";
import test from "node:test";
import { SourcePreviewStore, sourcePreviewResponse, type SourcePreview } from "../../src/lib/preview/source-preview.ts";
import { openPdf } from "../../src/lib/document-processing/pdf.ts";
import { createUploadHandler } from "../../src/lib/document-processing/upload-handler.ts";
import { UploadRateLimiter } from "../../src/lib/document-processing/rate-limit.ts";
import { RetrySessionStore } from "../../src/lib/document-processing/retry-sessions.ts";
import { createDiagramFixture, CHART_BOX } from "../diagram-extraction/fixtures.ts";
import type { RegionToPersist } from "../../src/lib/document-processing/types.ts";
import { resolveSourcePreviewUrl, boundSourcePreviews, MAX_INLINE_PREVIEW_CHARACTERS } from "../../src/lib/preview/source-preview-payload.ts";

const JOB = "12345678-1234-4234-8234-123456789abc";
const REGION = "12345678-1234-8234-8234-123456789abc";
const OTHER = "12345678-1234-4234-8234-123456789def";

test("source crop remains usable from upload response on a different server instance", () => {
  const store = new SourcePreviewStore();
  const png = new Uint8Array([137, 80, 78, 71]);
  const metadata = store.put(JOB, REGION, png);
  const otherInstance = new SourcePreviewStore();
  assert.equal(sourcePreviewResponse(otherInstance, JOB, REGION).status, 410);
  assert.equal(metadata.data_url,
    `data:image/png;base64,${Buffer.from(png).toString("base64")}`);
  assert.equal(resolveSourcePreviewUrl(metadata, "https://emboss.test"), metadata.data_url);
});

test("inline source survives cache expiry, while legacy route and error handling remain supported", () => {
  let now = 0;
  const store = new SourcePreviewStore({ now: () => now, ttlMs: 1 });
  const preview = store.put(JOB, REGION, new Uint8Array([137, 80, 78, 71]));
  now = 2;
  assert.equal(sourcePreviewResponse(store, JOB, REGION).status, 410);
  assert.equal(resolveSourcePreviewUrl(preview, "https://emboss.test"), preview.data_url);
  assert.equal(resolveSourcePreviewUrl({ url: "/api/source" }, "https://emboss.test"), "https://emboss.test/api/source");
  assert.throws(() => resolveSourcePreviewUrl({ url: "https://other.test/image.png" }, "https://emboss.test"));
  for (const data_url of ["data:text/html;base64,PHNjcmlwdD4=", "data:image/png;base64,!!!", "data:image/png;base64,", "data:image/png;base64," + "A".repeat(MAX_INLINE_PREVIEW_CHARACTERS)]) {
    assert.throws(() => resolveSourcePreviewUrl({ data_url }, "https://emboss.test"));
  }
  assert.throws(() => resolveSourcePreviewUrl({ error: "Fixture rendering failed" }, "https://emboss.test"), /Fixture rendering failed/);
});

test("preview payload is bounded across pages without changing session metadata or results", () => {
  const region: { id: string; geometry: { unchanged: boolean }; source_preview: SourcePreview } = {
    id: REGION, geometry: { unchanged: true }, source_preview: { data_url: "data:image/png;base64,iVBORw==", url: "/api/source" },
  };
  const budget = { remaining: region.source_preview.data_url!.length };
  assert.equal(boundSourcePreviews([region], budget)[0], region);
  const omitted = boundSourcePreviews([region], budget)[0];
  assert.match(omitted.source_preview.error!, /response limit/);
  assert.equal(omitted.source_preview.data_url, undefined);
  assert.equal(omitted.source_preview.url, undefined);
  assert.equal(omitted.geometry, region.geometry);
  assert.ok(region.source_preview.data_url);
});

test("temporary crops isolate job/region access, expire, and release bounded capacity", () => {
  let now = 1000;
  const store = new SourcePreviewStore({ now: () => now, ttlMs: 100, maxBytes: 4, maxEntries: 1 });
  const input = new Uint8Array([1, 2, 3, 4]);
  const metadata = store.put(JOB, REGION, input);
  assert.ok(metadata.url?.includes(JOB));
  input.fill(0);
  assert.deepEqual(store.get(JOB, REGION), new Uint8Array([1, 2, 3, 4]));
  assert.equal(store.get(OTHER, REGION), undefined);
  assert.equal(store.get(JOB, OTHER), undefined);
  assert.ok(store.put(OTHER, REGION, input).error);
  assert.equal(store.put(JOB, REGION, input).expires_at, metadata.expires_at);
  now += 101;
  assert.equal(store.get(JOB, REGION), undefined);
  assert.ok(store.put(OTHER, REGION, input).url);
});

test("source handler serves exact PNG bytes privately and handles invalid/missing IDs", async () => {
  const pdf = openPdf(createDiagramFixture());
  try {
    const png = pdf.rasterizeRegion(0, CHART_BOX);
    const store = new SourcePreviewStore();
    store.put(JOB, REGION, png);
    const response = sourcePreviewResponse(store, JOB, REGION);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), png);
    assert.equal(sourcePreviewResponse(store, "bad", REGION).status, 400);
    assert.equal(sourcePreviewResponse(store, OTHER, REGION).status, 410);
  } finally { pdf.destroy(); }
});

test("upload exposes original crops after PDF release without putting previews in persistence", async () => {
  const sessions = new RetrySessionStore();
  const store = new SourcePreviewStore();
  const saved: RegionToPersist[] = [];
  let calls = 0;
  const handler = createUploadHandler({
    config: { maxPdfPages: 3, maxUploadBytes: 7 * 1024 * 1024, uploadsPerIp: 5, maxGeminiValidationAttempts: 3 },
    rateLimiter: new UploadRateLimiter(), sessions, sourcePreviews: store, openPdf,
    classifier: { async classify() { calls++; return [{ region_id: "chart", type: "diagram", bounding_box: CHART_BOX }]; } },
    repository: {
      async createJob() { return JOB; },
      async insertRegions(_job, page, regions) { saved.push(...regions); return regions.map((r) => ({ ...r, id: page === 1 ? REGION : OTHER, review_status: "pending" as const })); },
      async markJobFailed() {},
    },
    textProcessor: { async process() { throw new Error("not used"); } },
    tableProcessor: { process() { throw new Error("not used"); } },
    diagramProcessor: { async process() { return { kind: "diagram", status: "failed", error: { code: "UNSUPPORTED", message: "Fixture perception omitted" } }; } },
  });
  const form = new FormData();
  form.set("file", new Blob([Uint8Array.from(createDiagramFixture())], { type: "application/pdf" }), "charts.pdf");
  const response = await handler(new Request("https://emboss.test/api/upload", { method: "POST", body: form }));
  const body = await response.json();
  assert.equal(response.status, 422);
  assert.ok(body.pages[0].regions[0].source_preview.url);
  assert.ok(body.pages[1].regions[0].source_preview.url);
  for (const page of body.pages) {
    const preview = page.regions[0].source_preview;
    assert.equal(resolveSourcePreviewUrl(preview, "https://emboss.test"), preview.data_url);
    assert.deepEqual(Buffer.from(preview.data_url.split(",")[1], "base64"), Buffer.from(store.get(JOB, page.regions[0].id)!));
  }
  assert.equal(sessions.get(JOB).bytes, null);
  assert.ok(saved.every((row) => !("source_preview" in row)));
  assert.equal(sourcePreviewResponse(store, JOB, REGION).status, 200);
  assert.equal(calls, 2);
  // Reading/refreshing a preview has no access to classification or extraction.
  sourcePreviewResponse(store, JOB, REGION);
  assert.equal(calls, 2);
});
