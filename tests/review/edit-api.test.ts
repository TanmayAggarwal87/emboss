import assert from "node:assert/strict";
import test from "node:test";
import { createRegionEditHandler, editRequestSchema } from "../../src/lib/review/edit-handler.ts";
import { UploadError } from "../../src/lib/document-processing/errors.ts";

const jobId = "00000000-0000-4000-8000-000000000001";
const regionId = "00000000-0000-4000-8000-000000000002";
const request = (body: unknown) => new Request("https://emboss.test/edit", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

test("accepts only a bounded, strict edit instruction body", () => {
  assert.equal(editRequestSchema.safeParse({ instruction: "Rename the x-axis to Month" }).success, true);
  assert.equal(editRequestSchema.safeParse({ instruction: "  " }).success, false);
  assert.equal(editRequestSchema.safeParse({ instruction: "x".repeat(1001) }).success, false);
  assert.equal(editRequestSchema.safeParse({ instruction: "Rename", extra: true }).success, false);
});

test("edit API validates IDs and request body before invoking edit service", async () => {
  let calls = 0;
  const handler = createRegionEditHandler(async () => { calls += 1; return {}; });
  assert.equal((await handler(request({ instruction: "Rename title" }), "bad", regionId)).status, 400);
  assert.equal((await handler(request({ instruction: "   " }), jobId, regionId)).status, 400);
  assert.equal(calls, 0);
});

test("edit API returns validated edited region from the service", async () => {
  const geometry = { version: 1 };
  const handler = createRegionEditHandler(async (job, region, instruction) => {
    assert.equal(job, jobId);
    assert.equal(region, regionId);
    assert.equal(instruction, "Rename x-axis to Month");
    return { region: { id: regionId, geometry, review_status: "pending" } };
  });
  const response = await handler(request({ instruction: "Rename x-axis to Month" }), jobId, regionId);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { region: { id: regionId, geometry, review_status: "pending" } });
});

test("edit API preserves clear domain errors and contains unexpected failures", async () => {
  const rejected = createRegionEditHandler(async () => { throw new UploadError(422, "EDIT_UNSUPPORTED", "Only title relabeling is supported."); });
  const rejectedResponse = await rejected(request({ instruction: "Move a bar" }), jobId, regionId);
  assert.equal(rejectedResponse.status, 422);
  assert.deepEqual(await rejectedResponse.json(), { error: { code: "EDIT_UNSUPPORTED", message: "Only title relabeling is supported." } });

  const failed = createRegionEditHandler(async () => { throw new Error("internal details"); });
  const failedResponse = await failed(request({ instruction: "Rename title" }), jobId, regionId);
  assert.equal(failedResponse.status, 503);
  assert.equal(JSON.stringify(await failedResponse.json()).includes("internal details"), false);
});
