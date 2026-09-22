import assert from "node:assert/strict";
import test from "node:test";
import { ClassificationServiceError, UploadError } from "../../src/lib/document-processing/errors.ts";
import { UploadRateLimiter } from "../../src/lib/document-processing/rate-limit.ts";
import { RetrySessionStore } from "../../src/lib/document-processing/retry-sessions.ts";
import { createRetryHandler, createUploadHandler, type UploadDependencies } from "../../src/lib/document-processing/upload-handler.ts";
import type { ClassifiedRegion, PersistedRegion } from "../../src/lib/document-processing/types.ts";

// Reserved example domain; these requests never leave the process.
const base = "https://emboss.test";
const jobId = "00000000-0000-4000-8000-000000000001";
const region: ClassifiedRegion = { region_id: "r1", type: "text", bounding_box: { x: 1, y: 1, width: 20, height: 20 } };

function harness(options: { allFailed?: boolean; status?: number; saveFailure?: boolean; statusFailure?: boolean; ttl?: number } = {}) {
  let now = 100_000;
  let recover = false;
  let failSave = options.saveFailure ?? false;
  let failStatus = options.statusFailure ?? false;
  let gate: (() => Promise<void>) | undefined;
  const calls: number[] = [];
  const saves: number[] = [];
  const statuses: string[] = [];
  const bytes: Uint8Array[] = [];
  const sessions = new RetrySessionStore({ now: () => now, ttlMs: options.ttl ?? 900_000 });
  const dependencies: UploadDependencies & { sessions: RetrySessionStore } = {
    config: { maxPdfPages: 3, maxUploadBytes: 7 * 1024 * 1024, uploadsPerIp: 5, maxGeminiValidationAttempts: 3 },
    rateLimiter: new UploadRateLimiter(), sessions,
    openPdf(data) {
      bytes.push(data);
      return { pageCount: 2, destroy() {}, extractTextRegion() { return "fixture"; },
        rasterizeRegion() { throw new Error("Unexpected OCR"); }, inspectTableRegion() { throw new Error("Unexpected table"); },
        rasterizePage(index) { return { pageNumber: index + 1, width: 100, height: 100, pngBase64: "fixture", hasTextLayer: true }; } };
    },
    classifier: { async classify(page) {
      calls.push(page.pageNumber);
      await gate?.();
      if (!recover && !options.saveFailure && (options.allFailed || page.pageNumber === 1)) {
        throw new ClassificationServiceError("fixture", undefined, options.status ?? 503);
      }
      return [region];
    } },
    repository: {
      async createJob() { return jobId; },
      async insertRegions(_id, page, regions) {
        saves.push(page);
        if (failSave && page === 1) { failSave = false; throw new UploadError(503, "DATABASE_ERROR", "fixture"); }
        return regions.map((entry): PersistedRegion => ({ id: `${page}-${entry.region_id}`, type: entry.type,
          bounding_box: entry.bounding_box, review_status: "pending", extracted_data: entry.extracted_data }));
      },
      async markJobFailed() { statuses.push("failed"); if (failStatus) { failStatus = false; throw new UploadError(503, "DATABASE_ERROR", "fixture"); } },
      async markJobProcessing() { statuses.push("processing"); },
    },
    textProcessor: { async process() { return { kind: "text", status: "processed", source: "text_layer", plain_text: "fixture",
      braille: "⠋", braille_grade: 2, braille_code: "UEB", translation_table: "en-ueb-g2.ctb", liblouis_version: "test", ocr_confidence: null, warnings: [] }; } },
    tableProcessor: { process() { throw new Error("Unexpected table"); } },
    diagramProcessor: { async process() { throw new Error("Unexpected diagram"); } },
  };
  const upload = createUploadHandler(dependencies);
  const retry = createRetryHandler(dependencies);
  return { calls, saves, statuses, bytes, sessions, dependencies,
    advance(ms = 60_001) { now += ms; }, recover() { recover = true; }, gate(value: () => Promise<void>) { gate = value; },
    async upload(signal?: AbortSignal) {
      const form = new FormData(); form.set("file", new File(["%PDF-1.7\nfixture"], "test.pdf", { type: "application/pdf" }));
      return upload(new Request(`${base}/api/upload`, { method: "POST", body: form, signal }));
    },
    retry(pages: number[], id = jobId) {
      return retry(new Request(`${base}/api/jobs/${id}/retry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pages }) }), id);
    },
  };
}

test("retry only failed pages, preserve successful rows, replay without any AI calls", async () => {
  const h = harness();
  const initial = await h.upload();
  assert.equal(initial.status, 207);
  const before = await initial.json();
  assert.deepEqual(before.retry.eligible_pages, [1]);
  h.advance(); h.recover();
  const recovered = await h.retry([1, 2]);
  assert.equal(recovered.status, 200);
  const after = await recovered.json();
  assert.deepEqual(after.pages[1], before.pages[1]);
  assert.deepEqual(h.calls, [1, 2, 1]);
  assert.deepEqual(h.saves, [2, 1]);
  assert.equal(h.bytes[0], h.bytes[1]);
  assert.equal(h.sessions.get(jobId).bytes, null);
  assert.equal((await h.retry([1])).status, 200);
  assert.deepEqual(h.calls, [1, 2, 1]);
});

test("pages execute sequentially, including retries selected in reverse order", async () => {
  const h = harness({ allFailed: true });
  let active = 0;
  h.gate(async () => { assert.equal(++active, 1); await new Promise((resolve) => setImmediate(resolve)); active--; });
  assert.equal((await h.upload()).status, 422);
  h.advance(); h.recover();
  assert.equal((await h.retry([2, 1])).status, 200);
  assert.deepEqual(h.calls, [1, 2, 1, 2]);
  assert.deepEqual(h.statuses, ["failed", "processing"]);
});

test("retry subset leaves unselected failed page intact", async () => {
  const h = harness({ allFailed: true });
  await h.upload(); h.advance(); h.recover();
  const response = await h.retry([2]);
  assert.equal(response.status, 207);
  assert.deepEqual((await response.json()).retry.eligible_pages, [1]);
  assert.deepEqual(h.calls, [1, 2, 2]);
});

test("DB failure resumes prepared page without repeating classification or text extraction", async () => {
  const h = harness({ saveFailure: true });
  await h.upload();
  const prepared = h.sessions.get(jobId).prepared.get(1)!;
  assert.equal(prepared.processed.length, 1);
  h.advance();
  assert.equal((await h.retry([1])).status, 200);
  assert.deepEqual(h.calls, [1, 2]);
  assert.deepEqual(h.saves, [1, 2, 1]);
});

test("job status write failure returns recovery URL and repairs failed status on recovery", async () => {
  const h = harness({ allFailed: true, statusFailure: true });
  const initial = await h.upload();
  assert.equal(initial.status, 503);
  assert.equal((await initial.json()).job_id, jobId);
  h.advance(); h.recover();
  assert.equal((await h.retry([1, 2])).status, 200);
  assert.deepEqual(h.statuses, ["failed", "processing"]);
});

test("cooldown, three-request cap and shared IP guard prevent unbounded calls", async () => {
  const h = harness();
  await h.upload();
  const cooldown = await h.retry([1]);
  assert.equal((await cooldown.json()).error.code, "RETRY_COOLDOWN");
  assert.deepEqual(h.calls, [1, 2]);
  for (let i = 0; i < 3; i++) { h.advance(); await h.retry([1]); }
  assert.equal((await (await h.retry([1])).json()).error.code, "RATE_LIMITED");
  // A different client still cannot bypass the per-job cap.
  h.dependencies.rateLimiter = new UploadRateLimiter();
  h.advance();
  assert.equal((await (await h.retry([1])).json()).error.code, "RETRY_LIMIT_REACHED");
  assert.deepEqual(h.calls, [1, 2, 1, 1, 1]);
});

test("concurrent retry is rejected while one attempt owns the job", async () => {
  const h = harness();
  await h.upload(); h.advance(); h.recover();
  let release!: () => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  h.gate(async () => { started(); await gate; });
  const pending = h.retry([1]);
  await ready;
  try { assert.equal((await (await h.retry([1])).json()).error.code, "RETRY_IN_PROGRESS"); }
  finally { release(); }
  assert.equal((await pending).status, 200);
  assert.deepEqual(h.calls, [1, 2, 1]);
});

test("permanent errors and expired sessions do not issue further Gemini calls", async () => {
  const permanent = harness({ status: 403 });
  await permanent.upload(); permanent.advance();
  assert.equal((await permanent.retry([1])).status, 409);
  assert.deepEqual(permanent.calls, [1, 2]);
  const expired = harness({ ttl: 100 });
  await expired.upload(); expired.advance();
  assert.equal((await expired.retry([1])).status, 410);
  assert.deepEqual(expired.calls, [1, 2]);
});

test("invalid page selections and job IDs are rejected before processing", async () => {
  const h = harness(); await h.upload(); h.advance();
  for (const pages of [[], [1, 1], [3]]) assert.equal((await h.retry(pages)).status, 400);
  assert.equal((await h.retry([1], "bad-id")).status, 400);
  assert.deepEqual(h.calls, [1, 2]);
});

test("aborted upload leaves pages retryable without starting AI", async () => {
  const h = harness(); const controller = new AbortController(); controller.abort();
  const initial = await h.upload(controller.signal);
  assert.equal(initial.status, 422);
  assert.deepEqual(h.calls, []);
  h.advance(); h.recover();
  assert.equal((await h.retry([1, 2])).status, 200);
  assert.deepEqual(h.calls, [1, 2]);
});

test("temporary store bounds bytes/sessions and releases PDFs on expiry", () => {
  let now = 0;
  const store = new RetrySessionStore({ maxSessions: 1, maxBytes: 4, ttlMs: 100, now: () => now });
  assert.throws(() => store.reserve(new Uint8Array(5), 2), UploadError);
  const entry = store.reserve(new Uint8Array(4), 2); entry.jobId = jobId;
  store.release(entry);
  assert.throws(() => store.reserve(new Uint8Array(1), 2), UploadError);
  now = 101;
  assert.throws(() => store.get(jobId), UploadError);
  assert.equal(entry.bytes, null);
  const next = store.reserve(new Uint8Array(1), 2); store.remove(next);
});
