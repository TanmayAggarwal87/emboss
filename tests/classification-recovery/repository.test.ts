import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseJobRepository, regionRowId } from "../../src/lib/document-processing/repository.ts";
import { UploadError } from "../../src/lib/document-processing/errors.ts";
import type { RegionToPersist } from "../../src/lib/document-processing/types.ts";

test("deterministic rows survive lost acknowledgements without duplicates or overwrites", async (context) => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://database.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-key";
  context.after(() => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  });
  type Row = { id: string; review_status: string; bounding_box: unknown };
  const saved = new Map<string, Row>();
  let loseAcknowledgement = true;
  context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.equal(url.hostname, "database.example.test");
    if (init?.method === "POST") {
      assert.match(new Headers(init.headers).get("prefer")!, /resolution=ignore-duplicates/);
      assert.equal(url.searchParams.get("on_conflict"), "id");
      for (const row of JSON.parse(String(init.body)) as Row[]) if (!saved.has(row.id)) saved.set(row.id, row);
      if (loseAcknowledgement) {
        loseAcknowledgement = false;
        return Response.json({ message: "Simulated lost acknowledgement" }, { status: 400 });
      }
      return new Response(null, { status: 201 });
    }
    assert.equal(url.searchParams.get("job_id"), "eq.00000000-0000-4000-8000-000000000001");
    return Response.json([...saved.values()].reverse());
  });
  const jobId = "00000000-0000-4000-8000-000000000001";
  const regions: RegionToPersist[] = ["a", "b"].map((region_id) => ({ region_id, type: "text",
    bounding_box: { x: 1, y: 2, width: 3, height: 4 } }));
  const repository = new SupabaseJobRepository();
  await assert.rejects(repository.insertRegions(jobId, 1, regions), UploadError);
  assert.equal(saved.size, 2);
  const firstId = regionRowId(jobId, 1, "a");
  saved.get(firstId)!.review_status = "approved";
  const result = await repository.insertRegions(jobId, 1, regions);
  assert.equal(saved.size, 2);
  assert.deepEqual(result.map((row) => row.id), regions.map((region) => regionRowId(jobId, 1, region.region_id)));
  assert.equal(result[0].review_status, "approved");
  assert.notEqual(firstId, regionRowId(jobId, 2, "a"));
  assert.notEqual(firstId, regionRowId("00000000-0000-4000-8000-000000000002", 1, "a"));
});
