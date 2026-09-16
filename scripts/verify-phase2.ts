import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
import { getSupabaseAdmin } from "../src/lib/supabase/admin.ts";
import { createTextFixture, TEXT_BOX, REFERENCE_TEXT, REFERENCE_GRADE_1, REFERENCE_GRADE_2 } from "../tests/phase2/fixtures.ts";

// A permanent CLI diagnostic, never an HTTP debug route. Classification uses
// fixed fixture boxes; this script cannot call Gemini and does not import its SDK.
const { values } = parseArgs({ options: {
  database: { type: "boolean", default: false },
  pdf: { type: "string" },
} });
if (existsSync(".env.local")) loadEnvFile(".env.local");
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const allowed = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!values.database || !allowed || url.origin !== new URL(allowed).origin) {
    throw new Error("This Phase 2 diagnostic forbids all network calls except the configured Supabase project with --database.");
  }
  return originalFetch(input, { ...init, signal: AbortSignal.timeout(20_000) });
};

async function verifyFixture(scanned: boolean) {
  const grade = getBrailleGrade();
  const expectedBraille = grade === 1 ? REFERENCE_GRADE_1 : REFERENCE_GRADE_2;
  const rows: PersistedRegion[] = [];
  const databaseRepository = values.database ? new SupabaseJobRepository() : undefined;
  let createdJobId: string | undefined;
  const repository: JobRepository = {
    async createJob(count) {
      const id = databaseRepository ? await databaseRepository.createJob(count) : "offline-fixture";
      createdJobId = id;
      return id;
    },
    async insertRegions(job, page, regions) {
      const saved: PersistedRegion[] = databaseRepository
        ? await databaseRepository.insertRegions(job, page, regions)
        : regions.map((region, index) => ({ id: `${page}-${index}`, type: region.type,
          bounding_box: region.bounding_box, review_status: "pending", extracted_data: region.extracted_data ?? null }));
      rows.push(...saved);
      return saved;
    },
    async markJobFailed(job, message) {
      if (databaseRepository) await databaseRepository.markJobFailed(job, message);
    },
  };
  try {
    const handler = createUploadHandler({
      config: { maxPdfPages: 3, maxUploadBytes: 7 * 1024 * 1024, uploadsPerIp: 5, maxGeminiValidationAttempts: 3 },
      rateLimiter: new UploadRateLimiter(), openPdf, repository,
      classifier: { async classify() { return [
        { region_id: "text", type: "text", bounding_box: TEXT_BOX },
        { region_id: "diagram", type: "diagram", bounding_box: { x: 180, y: 680, width: 200, height: 210 } },
      ]; } },
      textProcessor: new TextRegionProcessor(grade, new LocalTextRecognizer()),
    });
    const form = new FormData();
    form.set("file", new File([Uint8Array.from(createTextFixture({ scanned }))], "phase2-fixture.pdf", { type: "application/pdf" }));
    // Reserved test domain, in-memory Request only. There is no localhost/IP dependency.
    const response = await handler(new Request("https://emboss.test/api/upload", { method: "POST", body: form }));
    const body = await response.json();
    assert.equal(response.status, 201, JSON.stringify(body));
    assert.equal(body.status, "processing");
    assert.equal(rows.length, 4);
    for (const row of rows) {
      assert.equal(row.review_status, "pending");
      if (row.type !== "text") { assert.equal(row.extracted_data, null); continue; }
      assert.equal(row.extracted_data?.status, "processed");
      if (row.extracted_data?.status !== "processed") assert.fail("Text result missing.");
      assert.equal(row.extracted_data.plain_text, REFERENCE_TEXT);
      assert.equal(row.extracted_data.braille, expectedBraille);
      assert.equal(row.extracted_data.source, scanned ? "ocr" : "text_layer");
    }
    if (databaseRepository) {
      const { data, error } = await getSupabaseAdmin().from("regions")
        .select("id, type, bounding_box, review_status, extracted_data, geometry").eq("job_id", createdJobId!);
      assert.equal(error, null);
      assert.equal(data?.length, 4);
      for (const row of data ?? []) {
        assert.equal(row.geometry, null);
        const persisted = { id: row.id, type: row.type, bounding_box: row.bounding_box,
          review_status: row.review_status, extracted_data: row.extracted_data };
        assert.deepEqual(persisted, rows.find((saved) => saved.id === row.id));
      }
      const { data: job, error: jobError } = await getSupabaseAdmin().from("jobs")
        .select("status, page_count").eq("id", createdJobId!).single();
      assert.equal(jobError, null);
      assert.deepEqual(job, { status: "processing", page_count: 2 });
    }
    console.log(`PASS ${scanned ? "scanned" : "text-layer"} PDF: 2 text regions match UEB Grade ${grade} reference; 2 diagrams untouched; all pending${databaseRepository ? "; database read-back matches" : " (offline)"}.`);
  } finally {
    if (databaseRepository && createdJobId) {
      // Delete only the synthetic job created by this run; FK cascade removes its
      // fixture regions. No existing jobs, user uploads, or files are touched.
      const { error } = await getSupabaseAdmin().from("jobs").delete().eq("id", createdJobId);
      if (error) throw new Error(`Fixture cleanup failed. Remove only diagnostic job ${createdJobId}.`);
      console.log("Removed this diagnostic's synthetic job and regions.");
    }
  }
}

async function inspectPdf(path: string) {
  // Optional extraction smoke test on an existing local PDF. The entire page is
  // deliberately treated as text; this is not a substitute for Call A accuracy.
  const bytes = readFileSync(path);
  assert.ok(bytes.length <= 7 * 1024 * 1024, "The PDF must be at most 7 MB.");
  const document = openPdf(bytes);
  const processor = new TextRegionProcessor(getBrailleGrade(), new LocalTextRecognizer());
  try {
    assert.ok(document.pageCount >= 2 && document.pageCount <= 3, "Use a 2–3-page PDF.");
    for (let index = 0; index < document.pageCount; index += 1) {
      const page = document.rasterizePage(index);
      const result = await processor.process(document, page, { x: 0, y: 0, width: 1000, height: 1000 });
      assert.equal(result.status, "processed", JSON.stringify(result));
      if (result.status === "processed") {
        console.log(`PASS local PDF page ${index + 1}: ${result.plain_text.length} source characters → ${result.braille.length} braille characters (${result.source}).`);
      }
    }
  } finally { document.destroy(); }
}

try {
  await verifyFixture(false);
  await verifyFixture(true);
  if (values.pdf) await inspectPdf(values.pdf);
  console.log("Phase 2 verification passed. Gemini calls: 0.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Phase 2 verification failed.");
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
}
