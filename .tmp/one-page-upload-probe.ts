import { createUploadHandler } from "../src/lib/document-processing/upload-handler.ts";
import { UploadRateLimiter } from "../src/lib/document-processing/rate-limit.ts";
import { getPhase1Config } from "../src/lib/document-processing/config.ts";
import { SupabaseJobRepository } from "../src/lib/document-processing/repository.ts";
import { getSupabaseAdmin } from "../src/lib/supabase/admin.ts";

const actual = new SupabaseJobRepository();
let createdJobId: string | undefined;
const repository = {
  async createJob(pageCount: number) {
    createdJobId = await actual.createJob(pageCount);
    return createdJobId;
  },
  insertRegions: actual.insertRegions.bind(actual),
  markJobFailed: actual.markJobFailed.bind(actual),
  markJobReady: actual.markJobReady.bind(actual),
  markJobProcessing: actual.markJobProcessing.bind(actual),
};
const handler = createUploadHandler({
  config: getPhase1Config(), rateLimiter: new UploadRateLimiter(), repository,
  openPdf: () => ({
    pageCount: 1,
    rasterizePage: () => ({ pageNumber: 1, width: 600, height: 800, pngBase64: "cG5n", hasTextLayer: true }),
    rasterizeRegion: () => new Uint8Array(), extractTextRegion: () => "Sample",
    inspectTableRegion: () => { throw new Error("Not used."); }, destroy() {},
  }),
  classifier: { async classify() { return [{ region_id: "r1", type: "text", bounding_box: { x: 10, y: 10, width: 100, height: 20 } }]; } },
  textProcessor: { async process() { return { kind: "text", status: "processed", source: "text_layer", plain_text: "Sample",
    braille: "⠎⠁⠍⠏⠇⠑", braille_grade: 1, braille_code: "UEB", translation_table: "en-ueb-g1.ctb",
    liblouis_version: "diagnostic", ocr_confidence: null, warnings: [] }; } },
  tableProcessor: { process() { throw new Error("Not used."); } },
  diagramProcessor: { async process() { throw new Error("Not used."); } },
});

const form = new FormData();
form.set("file", new File(["%PDF-1.7\nprobe"], "probe.pdf", { type: "application/pdf" }));
const response = await handler(new Request("http://localhost/api/upload", { method: "POST", body: form,
  headers: { "x-forwarded-for": "192.0.2.1" } }));
const body = await response.json();
let cleanup = "not-needed";
if (createdJobId) {
  const result = await getSupabaseAdmin().from("jobs").delete().eq("id", createdJobId);
  cleanup = result.error ? "failed" : "complete";
  if (result.error) console.error(`Temporary diagnostic job needs cleanup: ${createdJobId}`);
}
console.log(JSON.stringify({ status: response.status, code: body.error?.code ?? null,
  pageCount: body.page_count ?? null, regionCount: body.pages?.[0]?.regions?.length ?? null, cleanup }));
if (response.status !== 201 || cleanup === "failed") process.exitCode = 1;
