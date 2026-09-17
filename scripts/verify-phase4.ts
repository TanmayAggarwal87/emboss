import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { parseArgs } from "node:util";
import { openPdf } from "../src/lib/phase1/pdf.ts";
import { SupabaseJobRepository } from "../src/lib/phase1/repository.ts";
import { DiagramRegionProcessor } from "../src/lib/phase4/diagram-processor.ts";
import { GeminiDiagramExtractor } from "../src/lib/phase4/gemini.ts";
import { parseDiagramResponse } from "../src/lib/phase4/schema.ts";
import { getSupabaseAdmin } from "../src/lib/supabase/admin.ts";
import { CHART_BOX, EXPECTED_CHARTS, createDiagramFixture } from "../tests/phase4/fixtures.ts";

// Explicit --live: at most two Call B requests, no Call A, no automatic retries.
const { values } = parseArgs({ options: {
  live: { type: "boolean", default: false },
  database: { type: "boolean", default: false },
  artifacts: { type: "boolean", default: false },
  chart: { type: "string" },
} });
if (values.chart && values.chart !== "bar" && values.chart !== "line") {
  throw new Error("--chart must be bar or line; omit it to check both.");
}
const selectedPages = values.chart ? [values.chart === "bar" ? 0 : 1] : [0, 1];
if (existsSync(".env.local")) loadEnvFile(".env.local");
const originalFetch = globalThis.fetch;
let modelRequests = 0;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (values.live && url.origin === "https://generativelanguage.googleapis.com") {
    modelRequests += 1;
    if (modelRequests > selectedPages.length) throw new Error("Live diagnostic reached its request ceiling.");
    return originalFetch(input, init);
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (values.database && supabaseUrl && url.origin === new URL(supabaseUrl).origin) {
    return originalFetch(input, { ...init, signal: AbortSignal.timeout(20_000) });
  }
  throw new Error("Diagnostic blocked a network request. Use --live for Gemini or --database for configured Supabase.");
};

let job: string | undefined;
const repository = values.database ? new SupabaseJobRepository() : undefined;
const bytes = createDiagramFixture();
const document = openPdf(bytes);
try {
  const folder = values.artifacts ? await mkdtemp(join(tmpdir(), "emboss-phase4-")) : undefined;
  if (folder) {
    await writeFile(join(folder, "fixture.pdf"), bytes);
    for (let page = 0; page < 2; page += 1) {
      await writeFile(join(folder, `chart-${page + 1}.png`), document.rasterizeRegion(page, CHART_BOX));
    }
    console.log(`Synthetic chart artifacts: ${folder}`);
  }
  if (values.live) console.log(`Live verification: at most ${selectedPages.length} Gemini Call B requests; stops on the first failure. No automatic retries.`);
  if (repository) job = await repository.createJob(2);
  let fixtureIndex = 0;
  const processor = new DiagramRegionProcessor(values.live ? new GeminiDiagramExtractor() : {
    async extract() { return parseDiagramResponse(JSON.stringify(EXPECTED_CHARTS[selectedPages[fixtureIndex++]])); },
  });
  for (const page of selectedPages) {
    const result = await processor.process(document, page, CHART_BOX, 1);
    if (folder) await writeFile(join(folder, `result-${page + 1}.json`), JSON.stringify(result, null, 2));
    assert.ok(result.status === "processed", JSON.stringify(result));
    // Compare against hand-specified fixture values, not another model answer.
    assert.deepEqual(result.data, EXPECTED_CHARTS[page]);
    assert.equal(result.needs_data_review, false);
    if (repository) {
      await repository.insertRegions(job!, page + 1, [{ region_id: `chart-${page + 1}`,
        type: "diagram", bounding_box: CHART_BOX, extracted_data: result }]);
    }
    console.log(`PASS page ${page + 1}: ${result.data.chart_type}, labels and all values match the source fixture.`);
  }
  if (repository) {
    const { data, error } = await getSupabaseAdmin().from("regions")
      .select("type, page_number, bounding_box, review_status, extracted_data, geometry")
      .eq("job_id", job!).order("page_number");
    assert.equal(error, null);
    assert.equal(data?.length, selectedPages.length);
    for (const [index, row] of (data ?? []).entries()) {
      assert.equal(row.type, "diagram");
      assert.equal(row.page_number, selectedPages[index] + 1);
      assert.deepEqual(row.bounding_box, CHART_BOX);
      assert.equal(row.review_status, "pending");
      assert.equal(row.geometry, null);
      assert.deepEqual(row.extracted_data, { kind: "diagram", status: "processed", source: "gemini",
        data: EXPECTED_CHARTS[selectedPages[index]], needs_data_review: false, warnings: [] });
    }
    console.log(`PASS Supabase: exactly ${selectedPages.length} matching diagram rows, pending review, null geometry.`);
  }
  console.log(`Phase 4 verification passed. Gemini HTTP requests: ${modelRequests}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Phase 4 verification failed.");
  process.exitCode = 1;
} finally {
  document.destroy();
  try {
    if (repository && job) {
      const { error } = await getSupabaseAdmin().from("jobs").delete().eq("id", job);
      if (error) throw new Error(`Cleanup failed; remove only synthetic diagnostic job ${job}.`);
      console.log("Removed this diagnostic's synthetic job and regions.");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : `Cleanup failed for synthetic job ${job}.`);
    process.exitCode = 1;
  } finally { globalThis.fetch = originalFetch; }
}
