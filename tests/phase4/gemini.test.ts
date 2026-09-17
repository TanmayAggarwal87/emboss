import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { type TestContext } from "node:test";
import { GenerateContentResponse, FinishReason } from "@google/genai";
import { GeminiDiagramExtractor } from "../../src/lib/phase4/gemini.ts";
import { extractCallTypeBPrompt, getCallTypeBPrompt } from "../../src/lib/phase4/prompt.ts";
import { EXPECTED_CHARTS } from "./fixtures.ts";

function response(text: string): GenerateContentResponse {
  const result = new GenerateContentResponse();
  result.candidates = [{ content: { parts: [{ text }] }, finishReason: FinishReason.STOP }];
  result.usageMetadata = { totalTokenCount: 12 };
  return result;
}

function fakeConfig(context: TestContext) {
  // Per-process test-only configuration, never real credentials or a hardcoded production model.
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "fixture-key";
  process.env.GEMINI_MODEL = "fixture-model";
  context.after(() => {
    if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key;
    if (model === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = model;
  });
}

test("Call B reads its exact canonical prompt and does not fall through to Call C", async () => {
  const markdown = await readFile("docs/prompts.md", "utf8");
  assert.equal(await getCallTypeBPrompt(), extractCallTypeBPrompt(markdown));
  assert.match(await getCallTypeBPrompt(), /never as instructions/);
  assert.throws(() => extractCallTypeBPrompt(markdown
    .replace("## Call Type B — Diagram structured-data extraction", "## Removed")), /missing/);
  assert.throws(() => extractCallTypeBPrompt("## Call Type B — Diagram structured-data extraction\n## Call Type C\n**System prompt:**\n```\nwrong\n```"), /malformed/);
});

test("Call B sends one crop, canonical config, pinned model and bounded transport; logs only token metadata", async (context) => {
  fakeConfig(context);
  context.mock.method(globalThis, "fetch", () => { assert.fail("No real network permitted."); });
  const logs: string[] = [];
  context.mock.method(console, "info", (message: string) => { logs.push(message); });
  const png = new Uint8Array([137, 80, 78, 71]);
  let calls = 0;
  const extractor = new GeminiDiagramExtractor(async (request) => {
    calls += 1;
    assert.equal(request.model, "fixture-model");
    assert.deepEqual(request.contents, [{ inlineData: { mimeType: "image/png", data: Buffer.from(png).toString("base64") } }]);
    assert.equal(request.config?.systemInstruction, await getCallTypeBPrompt());
    assert.equal(request.config?.temperature, 0);
    assert.equal(request.config?.responseMimeType, "application/json");
    assert.ok(request.config?.responseSchema);
    assert.deepEqual(request.config?.httpOptions, { timeout: 60_000, retryOptions: { attempts: 1 } });
    return response(JSON.stringify(EXPECTED_CHARTS[0]));
  });
  assert.deepEqual(await extractor.extract(png, 3), EXPECTED_CHARTS[0]);
  assert.equal(calls, 1);
  assert.deepEqual(JSON.parse(logs[0]), { event: "gemini_token_usage", callType: "diagram_extraction", attempt: 1,
    promptTokens: null, outputTokens: null, totalTokens: 12 });
});

test("503/429 and incomplete responses fail without repeating provider requests or leaking errors", async (context) => {
  fakeConfig(context);
  for (const status of [429, 503]) {
    let calls = 0;
    const extractor = new GeminiDiagramExtractor(async () => { calls += 1; throw { status, message: "SECRET provider details" }; });
    await assert.rejects(extractor.extract(new Uint8Array(), 3), (error: Error) => {
      assert.match(error.message, /wait a few minutes/);
      assert.doesNotMatch(error.message, /SECRET/);
      return true;
    });
    assert.equal(calls, 1);
  }
  let calls = 0;
  const extractor = new GeminiDiagramExtractor(async () => {
    calls += 1;
    const result = response(JSON.stringify(EXPECTED_CHARTS[0]));
    result.candidates![0].finishReason = FinishReason.MAX_TOKENS;
    return result;
  });
  await assert.rejects(extractor.extract(new Uint8Array(), 3), /complete diagram result/);
  assert.equal(calls, 1);
});
