import assert from "node:assert/strict";
import test from "node:test";
import { GenerateContentResponse } from "@google/genai";
import { generateGeometry } from "../../src/lib/tactile-geometry/generate.ts";
import { DEFAULT_PROFILE } from "../../src/lib/tactile-geometry/profile.ts";
import { validateGeometry } from "../../src/lib/tactile-geometry/validate.ts";
import { EXPECTED_CHARTS } from "../diagram-extraction/fixtures.ts";
import { applyValidatedEdit, editOperationSchema } from "../../src/lib/review/edit-operations.ts";
import { GeminiEditAgent } from "../../src/lib/review/gemini-edit-agent.ts";

const geometry = () => generateGeometry(EXPECTED_CHARTS[0], { ...DEFAULT_PROFILE }, 1);

test("relabels an approved title without changing source chart data and revalidates it", () => {
  const before = geometry();
  const result = applyValidatedEdit(before, {
    operation: "relabel", element_id: "label-x-title", detail: "new label text: Calendar month",
  }, "Please relabel the x-axis title to Calendar month");
  const title = result.elements.find((element) => element.id === "label-x-title");
  assert.equal(title?.kind, "label");
  if (title?.kind !== "label") return;
  assert.equal(title.text, "Calendar month");
  const originalTitle = before.elements.find((element) => element.id === title.id);
  assert.equal(originalTitle?.kind, "label");
  assert.notEqual(title.braille, originalTitle?.kind === "label" ? originalTitle.braille : undefined);
  assert.deepEqual(result.source, before.source);
  assert.deepEqual(validateGeometry(result), []);
});

test("rejects unsupported operations, semantic data labels, and replacement text not present in the human request", () => {
  const before = geometry();
  assert.equal(editOperationSchema.safeParse({ operation: "move", element_id: "label-x-title", detail: "left" }).success, false);
  assert.throws(() => applyValidatedEdit(before, {
    operation: "relabel", element_id: "label-x-0", detail: "new label text: Quarter",
  }, "Change the first category label to Quarter"), /not an editable title/);
  assert.throws(() => applyValidatedEdit(before, {
    operation: "relabel", element_id: "label-x-title", detail: "new label text: Invented",
  }, "Change the x-axis title to something shorter"), /appear verbatim/);
});

test("rejects edits that cause geometry validation failures and leaves the input unchanged", () => {
  const before = geometry();
  const original = structuredClone(before);
  assert.throws(() => applyValidatedEdit(before, {
    operation: "relabel", element_id: "label-x-title", detail: `new label text: ${"Long title ".repeat(100)}`,
  }, `Please change the x-axis title to ${"Long title ".repeat(100)}`), /failed BANA geometry validation/);
  assert.deepEqual(before, original);
});

test("title-edit Gemini usage is attributed to the document without logging edit text", async (context) => {
  const previous = { key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL };
  process.env.GEMINI_API_KEY = "fixture-key";
  process.env.GEMINI_MODEL = "fixture-model";
  context.after(() => {
    if (previous.key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous.key;
    if (previous.model === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = previous.model;
  });
  const logs: string[] = [];
  context.mock.method(console, "info", (message: string) => { logs.push(message); });
  const agent = new GeminiEditAgent(async () => {
    const response = new GenerateContentResponse();
    response.candidates = [{ content: { parts: [{ text: JSON.stringify({
      operation: "relabel", element_id: "label-x-title", detail: "new label text: Calendar month",
    }) }] } }];
    response.usageMetadata = { promptTokenCount: 20, candidatesTokenCount: 5, totalTokenCount: 25 };
    return response;
  });
  assert.equal((await agent.propose(geometry(), "Use Calendar month", "test-job")).operation, "relabel");
  assert.deepEqual(JSON.parse(logs[0]), { event: "gemini_token_usage", callType: "edit_interpreter",
    jobId: "test-job", model: "fixture-model", attempt: 1, promptTokens: 20, outputTokens: 5, totalTokens: 25 });
  assert.doesNotMatch(logs[0], /Calendar month|fixture-key/);
});
