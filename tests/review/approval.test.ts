import assert from "node:assert/strict";
import test from "node:test";
import { createRegionApprovalHandler } from "../../src/lib/review/approval-handler.ts";
import { countApprovedRegions, withApprovedRegion } from "../../src/lib/review/approval-state.ts";
import { UploadError } from "../../src/lib/document-processing/errors.ts";
import type { PersistedRegionItem } from "../../src/lib/frontend-types.ts";

const jobId = "00000000-0000-4000-8000-000000000001";
const regionId = "00000000-0000-4000-8000-000000000002";
const base = "https://emboss.test";

test("approves one region and returns its persisted status", async () => {
  const calls: string[][] = [];
  const handler = createRegionApprovalHandler(async (job, region) => {
    calls.push([job, region]);
    return { id: region, review_status: "approved" };
  });
  const response = await handler(new Request(`${base}/api/jobs/${jobId}/regions/${regionId}/approve`, { method: "POST" }), jobId, regionId);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { region: { id: regionId, review_status: "approved" } });
  assert.deepEqual(calls, [[jobId, regionId]]);
});

test("rejects malformed identifiers before touching the repository", async () => {
  let called = false;
  const handler = createRegionApprovalHandler(async () => { called = true; return { id: regionId, review_status: "approved" }; });
  const response = await handler(new Request(`${base}/api/jobs/bad/regions/${regionId}/approve`, { method: "POST" }), "bad", regionId);
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("returns clear not-found and not-approvable errors", async () => {
  for (const expected of [
    new UploadError(404, "REGION_NOT_FOUND", "This region could not be found."),
    new UploadError(422, "REGION_NOT_READY", "This region has no validated output to approve."),
  ]) {
    const handler = createRegionApprovalHandler(async () => { throw expected; });
    const response = await handler(new Request(`${base}/api/jobs/${jobId}/regions/${regionId}/approve`, { method: "POST" }), jobId, regionId);
    assert.equal(response.status, expected.status);
    assert.deepEqual(await response.json(), { error: { code: expected.code, message: expected.message } });
  }
});

test("approving one region preserves the rest of the review list for individual decisions", () => {
  const regions = [regionId, "00000000-0000-4000-8000-000000000003"].map((id): PersistedRegionItem => ({
    id, job_id: jobId, page_number: 1, type: "text", bounding_box: { x: 0, y: 0, width: 1, height: 1 },
    review_status: "pending", extracted_data: null,
  }));
  const updated = withApprovedRegion(regions, regionId);
  assert.deepEqual(updated.map((region) => region.review_status), ["approved", "pending"]);
  assert.equal(countApprovedRegions(updated), 1);
});
