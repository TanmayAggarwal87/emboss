import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseJobRepository } from "../../src/lib/document-processing/repository.ts";
import { UploadError } from "../../src/lib/document-processing/errors.ts";
import { generateGeometry } from "../../src/lib/tactile-geometry/generate.ts";
import { DEFAULT_PROFILE } from "../../src/lib/tactile-geometry/profile.ts";
import { EXPECTED_CHARTS } from "../diagram-extraction/fixtures.ts";
import type { RegionToPersist } from "../../src/lib/document-processing/types.ts";

test("persistence rejects invalid or mismatched geometry before any database call", async (context) => {
  context.mock.method(globalThis, "fetch", () => { assert.fail("Invalid geometry must never reach the database"); });
  const geometry = generateGeometry(EXPECTED_CHARTS[0], DEFAULT_PROFILE, 1);
  const row: RegionToPersist = { region_id: "r0", type: "diagram", bounding_box: { x: 1, y: 1, width: 10, height: 10 },
    extracted_data: { kind: "diagram", status: "processed", source: "gemini", data: EXPECTED_CHARTS[0],
      needs_data_review: false, warnings: [], geometry_processing: { status: "validated" } }, geometry };
  const repository = new SupabaseJobRepository();
  const corrupt = structuredClone(row); corrupt.geometry!.plate.width = 500;
  await assert.rejects(repository.insertRegions("fixture-job", 1, [corrupt]), UploadError);
  await assert.rejects(repository.insertRegions("fixture-job", 1, [{ ...row, geometry: null }]), UploadError);
  await assert.rejects(repository.insertRegions("fixture-job", 1, [{ ...row, geometry: generateGeometry(EXPECTED_CHARTS[1], DEFAULT_PROFILE, 1) }]), UploadError);
  await assert.rejects(repository.insertRegions("fixture-job", 1, [{ ...row, type: "text" }]), UploadError);
});
