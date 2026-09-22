import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyWithValidationRetries,
  parseClassificationResponse,
} from "../../src/lib/document-processing/classification-schema.ts";

const validResponse = JSON.stringify([
  {
    region_id: "r1",
    type: "text",
    bounding_box: { x: 10, y: 20, width: 100, height: 80 },
  },
]);

test("accepts strict in-bounds classification data", () => {
  const result = parseClassificationResponse(validResponse, 500, 700);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.type, "text");
});

test("rejects transcribed text and other extra keys", () => {
  const response = JSON.stringify([
    {
      region_id: "r1",
      type: "text",
      text: "This must never cross the classification boundary.",
      bounding_box: { x: 10, y: 20, width: 100, height: 80 },
    },
  ]);

  assert.throws(() => parseClassificationResponse(response, 500, 700));
});

test("rejects out-of-bounds boxes instead of clamping them", () => {
  const response = JSON.stringify([
    {
      region_id: "r1",
      type: "diagram",
      bounding_box: { x: 450, y: 20, width: 100, height: 80 },
    },
  ]);

  assert.throws(() => parseClassificationResponse(response, 500, 700));
});

test("retries validation failures up to the configured total", async () => {
  let calls = 0;
  const result = await classifyWithValidationRetries(
    async () => {
      calls += 1;
      return { text: calls < 3 ? "not json" : validResponse };
    },
    500,
    700,
    3,
  );

  assert.equal(calls, 3);
  assert.equal(result[0]?.region_id, "r1");
});

test("fails after exactly three invalid responses", async () => {
  let calls = 0;

  await assert.rejects(
    classifyWithValidationRetries(
      async () => {
        calls += 1;
        return { text: "not json" };
      },
      500,
      700,
      3,
    ),
    /after 3 attempts/,
  );
  assert.equal(calls, 3);
});
