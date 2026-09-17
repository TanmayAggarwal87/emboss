import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { parseArgs } from "node:util";

import { openPdf } from "../src/lib/phase1/pdf.ts";
import { UploadRateLimiter } from "../src/lib/phase1/rate-limit.ts";
import { SupabaseJobRepository } from "../src/lib/phase1/repository.ts";
import type { JobRepository, PersistedRegion } from "../src/lib/phase1/types.ts";
import { createUploadHandler } from "../src/lib/phase1/upload-handler.ts";
import { getBrailleGrade } from "../src/lib/phase2/config.ts";
import { LocalTextRecognizer } from "../src/lib/phase2/ocr.ts";
import { TextRegionProcessor } from "../src/lib/phase2/text-processor.ts";
import { TableRegionProcessor } from "../src/lib/phase3/table-processor.ts";
import { DiagramRegionProcessor } from "../src/lib/phase4/diagram-processor.ts";
import { getSupabaseAdmin } from "../src/lib/supabase/admin.ts";
import { createTableFixture, TABLE_BOX, TABLE_HEADERS, TABLE_ROWS } from "../tests/phase3/fixtures.ts";

const { values } = parseArgs({ options: {
  database: { type: "boolean", default: false },
  artifacts: { type: "boolean", default: false },
} });
if (existsSync(".env.local")) loadEnvFile(".env.local");
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const allowed = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!values.database || !allowed || url.origin !== new URL(allowed).origin) {
    throw new Error("Phase 3 verification forbids network requests except configured Supabase with --database.");
  }
  return originalFetch(input, { ...init, signal: AbortSignal.timeout(20_000) });
};

const rows: PersistedRegion[] = [];
const database = values.database ? new SupabaseJobRepository() : undefined;
let createdJob: string | undefined;
const repository: JobRepository = {
  async createJob(count) {
    createdJob = database ? await database.createJob(count) : "offline-fixture";
    return createdJob;
  },
  async insertRegions(job, page, regions) {
    const saved: PersistedRegion[] = database ? await database.insertRegions(job, page, regions)
      : regions.map((region, index) => ({ id: `${page}-${index}`, type: region.type,
        bounding_box: region.bounding_box, review_status: "pending", extracted_data: region.extracted_data ?? null }));
    rows.push(...saved);
    return saved;
  },
  async markJobFailed(job, message) { if (database) await database.markJobFailed(job, message); },
};

try {
  const grade = getBrailleGrade();
  const bytes = createTableFixture(["ruled", "merged", "mixed_image"]);
  const handler = createUploadHandler({
    config: { maxPdfPages: 3, maxUploadBytes: 7 * 1024 * 1024, uploadsPerIp: 5, maxGeminiValidationAttempts: 3 },
    rateLimiter: new UploadRateLimiter(), openPdf, repository,
    // Fixed fixture classification only. The Gemini client is never imported.
    classifier: { async classify() { return [{ region_id: "table", type: "table", bounding_box: TABLE_BOX }]; } },
    textProcessor: new TextRegionProcessor(grade, new LocalTextRecognizer()),
    tableProcessor: new TableRegionProcessor(grade),
    // Keep this diagnostic quota-free: real diagram processing, fixed unsupported perception.
    diagramProcessor: new DiagramRegionProcessor({ async extract() { return { chart_type: "unsupported" }; } }),
  });
  const form = new FormData();
  form.set("file", new File([Uint8Array.from(bytes)], "phase3-fixture.pdf", { type: "application/pdf" }));
  const response = await handler(new Request("https://emboss.test/api/upload", { method: "POST", body: form }));
  const body = await response.json();
  assert.equal(response.status, 207, JSON.stringify(body));
  assert.equal(body.status, "processing");
  assert.deepEqual(rows.map((row) => row.type), ["table", "table", "diagram"]);
  assert.ok(rows.every((row) => row.review_status === "pending"));
  const good = rows[0].extracted_data;
  assert.ok(good?.kind === "table" && good.status === "processed");
  assert.deepEqual(good.headers, TABLE_HEADERS);
  assert.deepEqual(good.rows, TABLE_ROWS);
  assert.deepEqual(good.column_alignment, ["left", "right"]);
  assert.equal(good.braille_rows[1][1], "⠤⠤");
  const lines = good.braille_pages[0].split("\n");
  assert.equal(lines[1], "");
  assert.ok(lines.length <= 25 && lines.every((line) => line.length <= 40));
  assert.ok(lines.filter(Boolean).every((line) => line.slice(good.column_widths_cells[0], good.column_widths_cells[0] + 3) === "   "));
  const bad = rows[1].extracted_data;
  assert.ok(bad?.status === "failed" && bad.error.code === "TABLE_MERGED_CELLS");
  const imageTable = rows[2].extracted_data;
  assert.ok(imageTable?.kind === "diagram" && imageTable.status === "failed" && imageTable.error.code === "DIAGRAM_UNSUPPORTED");
  if (database) {
    const { data, error } = await getSupabaseAdmin().from("regions")
      .select("id, type, bounding_box, review_status, extracted_data, geometry, page_number").eq("job_id", createdJob!).order("page_number");
    assert.equal(error, null);
    assert.equal(data?.length, 3);
    for (const [index, row] of (data ?? []).entries()) {
      assert.equal(row.geometry, null);
      assert.equal(row.page_number, index + 1);
      assert.deepEqual({ id: row.id, type: row.type, bounding_box: row.bounding_box,
        review_status: row.review_status, extracted_data: row.extracted_data }, rows[index]);
    }
    const { data: job, error: jobError } = await getSupabaseAdmin().from("jobs")
      .select("status, page_count").eq("id", createdJob!).single();
    assert.equal(jobError, null);
    assert.deepEqual(job, { status: "processing", page_count: 3 });
    console.log("PASS Supabase: 3 rows match types, cell data, braille, errors, bounds and pending review; geometry is null.");
  }
  console.log("PASS table extraction and braille layout; merged-table rejection; image table routed to diagram. Gemini calls: 0.");
  if (values.artifacts) {
    const folder = await mkdtemp(join(tmpdir(), "emboss-phase3-"));
    const document = openPdf(bytes);
    try {
      await writeFile(join(folder, "fixture.pdf"), bytes);
      await writeFile(join(folder, "page-1.png"), Buffer.from(document.rasterizePage(0).pngBase64, "base64"));
      await writeFile(join(folder, "table-result.json"), JSON.stringify(good, null, 2));
      console.log(`Synthetic visual verification artifacts: ${folder}`);
    } finally { document.destroy(); }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Phase 3 verification failed.");
  process.exitCode = 1;
} finally {
  if (database && createdJob) {
    const { error } = await getSupabaseAdmin().from("jobs").delete().eq("id", createdJob);
    if (error) {
      console.error(`Cleanup failed. Remove only synthetic diagnostic job ${createdJob}.`);
      process.exitCode = 1;
    } else console.log("Removed this diagnostic's synthetic job and regions.");
  }
  globalThis.fetch = originalFetch;
}
