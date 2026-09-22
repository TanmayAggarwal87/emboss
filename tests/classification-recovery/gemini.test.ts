import assert from "node:assert/strict";
import test from "node:test";
import { GenerateContentResponse } from "@google/genai";
import { GeminiRegionClassifier } from "../../src/lib/document-processing/gemini.ts";
import { ClassificationServiceError, ClassificationValidationError } from "../../src/lib/document-processing/errors.ts";
import { withProviderRetries } from "../../src/lib/document-processing/provider-retry.ts";

for (const status of [429, 503]) {
  test(`${status}: two delayed retries, then success or bounded exhaustion`, async () => {
    for (const recover of [true, false]) {
      let calls = 0;
      const delays: number[] = [];
      const result = withProviderRetries(async () => {
        calls++;
        if (recover && calls === 3) return "ok";
        throw { status };
      }, { used: 0 }, { async sleep(ms) { delays.push(ms); } });
      if (recover) assert.equal(await result, "ok");
      else await assert.rejects(result, (error: unknown) => (error as { status: number }).status === status);
      assert.equal(calls, 3);
      assert.deepEqual(delays, [30_000, 90_000]);
    }
  });
}

test("non-transient errors and status-like messages never trigger automatic retries", async () => {
  for (const error of [{ status: 400 }, { status: 401 }, { status: 403 }, { status: 404 },
    { status: 500 }, { status: 504 }, { status: "503" }, new Error("503 unavailable"), new DOMException("aborted", "AbortError")]) {
    let calls = 0;
    await assert.rejects(withProviderRetries(async () => { calls++; throw error; }, { used: 0 },
      { async sleep() { assert.fail("Non-transient errors must not sleep/retry"); } }), (caught: unknown) => caught === error);
    assert.equal(calls, 1);
  }
});

test("cancelling during backoff prevents another provider request", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(withProviderRetries(async () => { calls++; throw { status: 503 }; }, { used: 0 }, {
    signal: controller.signal, async sleep() { controller.abort(); },
  }), { name: "AbortError" });
  assert.equal(calls, 1);
});

test("provider retry budget is shared across separate Zod attempts; SDK retries are disabled", async (context) => {
  const previous = { key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL };
  process.env.GEMINI_API_KEY = "fixture-key";
  process.env.GEMINI_MODEL = "fixture-model";
  context.after(() => {
    if (previous.key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous.key;
    if (previous.model === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = previous.model;
  });
  context.mock.method(globalThis, "fetch", () => { assert.fail("No network allowed"); });
  for (const ending of ["[]", "invalid", 503]) {
    const outcomes = [429, "invalid", 503, "invalid", ending];
    let calls = 0;
    const delays: number[] = [];
    const classifier = new GeminiRegionClassifier({ async generate(request) {
      assert.equal(request.model, "fixture-model");
      assert.deepEqual(request.config?.httpOptions, { timeout: 60_000, retryOptions: { attempts: 1 } });
      assert.match(String(request.config?.systemInstruction), /transcrib/i);
      const outcome = outcomes[calls++];
      if (typeof outcome === "number") throw { status: outcome };
      const response = new GenerateContentResponse();
      response.candidates = [{ content: { parts: [{ text: outcome }] } }];
      return response;
    }, async sleep(ms) { delays.push(ms); } });
    const result = classifier.classify({ pageNumber: 1, width: 1000, height: 1000, pngBase64: "fixture", hasTextLayer: true }, 3);
    if (ending === "[]") assert.deepEqual(await result, []);
    else await assert.rejects(result, ending === 503 ? ClassificationServiceError : ClassificationValidationError);
    assert.equal(calls, 5);
    assert.deepEqual(delays, [30_000, 90_000]);
  }
});

test("a temporary 503 followed by success recovers the same page", async (context) => {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "fixture-key";
  process.env.GEMINI_MODEL = "fixture-model";
  context.after(() => {
    if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key;
    if (model === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = model;
  });
  context.mock.method(globalThis, "fetch", () => { assert.fail("No real Gemini calls in regression tests."); });
  let calls = 0;
  const delays: number[] = [];
  const classifier = new GeminiRegionClassifier({
    async generate() {
      calls += 1;
      if (calls === 1) throw { status: 503 };
      const response = new GenerateContentResponse();
      response.candidates = [{ content: { parts: [{ text: "[]" }] } }];
      return response;
    },
    async sleep(ms) { delays.push(ms); },
  });
  assert.deepEqual(await classifier.classify({ pageNumber: 1, width: 1000, height: 1000,
    pngBase64: "fixture", hasTextLayer: true }, 3), []);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [30_000]);
});
