import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import * as mupdf from "mupdf";

import { openPdf } from "../../src/lib/phase1/pdf.ts";
import { TextRegionProcessor } from "../../src/lib/phase2/text-processor.ts";
import { LocalTextRecognizer } from "../../src/lib/phase2/ocr.ts";
import { TextProcessingError } from "../../src/lib/phase2/errors.ts";
import { createTextFixture, TEXT_BOX, REFERENCE_TEXT, REFERENCE_GRADE_2 } from "./fixtures.ts";

test("MuPDF extraction stays inside both axes of a padded classification box", () => {
  const document = openPdf(createTextFixture());
  try {
    assert.equal(document.extractTextRegion(0, TEXT_BOX), REFERENCE_TEXT);
    assert.equal(document.extractTextRegion(0, { x: 0, y: 0, width: 80, height: 1000 }), "");
    assert.throws(() => document.extractTextRegion(0, { ...TEXT_BOX, x: -1 }), /outside/);
    assert.throws(() => document.rasterizeRegion(0, { ...TEXT_BOX, width: Infinity }), /outside/);
  } finally { document.destroy(); }
});

test("rotation and nonzero CropBox offsets map to the same visible text", () => {
  for (const rotation of [0, 90, 180, 270] as const) {
    const bytes = createTextFixture({ rotation, crop: true });
    const source = mupdf.Document.openDocument(bytes, "application/pdf");
    const page = source.loadPage(0);
    const structured = page.toStructuredText("preserve-whitespace");
    const document = openPdf(bytes);
    try {
      // Independent visible bounds of the first line, in MuPDF page space.
      let firstLine: mupdf.Rect | undefined;
      structured.walk({ beginLine(bounds) { firstLine ??= bounds; } });
      assert.ok(firstLine);
      const [x0, y0, x1, y1] = page.getBounds();
      const scale = 1000 / Math.max(x1 - x0, y1 - y0);
      const offsetX = (1000 - (x1 - x0) * scale) / 2;
      const offsetY = (1000 - (y1 - y0) * scale) / 2;
      const box = { x: (firstLine[0] - x0) * scale + offsetX - 1,
        y: (firstLine[1] - y0) * scale + offsetY - 1,
        width: (firstLine[2] - firstLine[0]) * scale + 2,
        height: (firstLine[3] - firstLine[1]) * scale + 2 };
      assert.equal(document.extractTextRegion(0, box), REFERENCE_TEXT, `rotation ${rotation}`);
    } finally { structured.destroy(); page.destroy(); source.destroy(); document.destroy(); }
  }
});

test("normal text pipeline produces braille without OCR or network calls", async (context) => {
  context.mock.method(globalThis, "fetch", () => { throw new Error("Network is forbidden in Phase 2."); });
  const processor = new TextRegionProcessor(2, { async recognize() { assert.fail("Normal text must never use OCR."); } });
  const document = openPdf(createTextFixture());
  try {
    const result = await processor.process(document, document.rasterizePage(0), TEXT_BOX);
    assert.equal(result.status, "processed");
    if (result.status !== "processed") assert.fail(JSON.stringify(result));
    assert.equal(result.plain_text, REFERENCE_TEXT);
    assert.equal(result.braille, REFERENCE_GRADE_2);
    assert.equal(result.source, "text_layer");
    assert.equal(result.ocr_confidence, null);
    assert.deepEqual(result.warnings, []);
    const empty = await processor.process(document, document.rasterizePage(0), { x: 0, y: 0, width: 50, height: 50 });
    assert.equal(empty.status, "failed");
  } finally { document.destroy(); }
});

test("real scanned PDF uses local OCR and translates only the requested crop", { timeout: 90_000 }, async () => {
  const document = openPdf(createTextFixture({ scanned: true }));
  try {
    const page = document.rasterizePage(0);
    assert.equal(page.hasTextLayer, false);
    const processor = new TextRegionProcessor(2, new LocalTextRecognizer());
    const result = await processor.process(document, page, TEXT_BOX);
    assert.equal(result.status, "processed", JSON.stringify(result));
    if (result.status !== "processed") assert.fail(JSON.stringify(result));
    assert.equal(result.plain_text, REFERENCE_TEXT);
    assert.equal(result.braille, REFERENCE_GRADE_2);
    assert.equal(result.source, "ocr");
    assert.ok(result.ocr_confidence !== null && result.ocr_confidence >= 60);
    assert.equal(result.warnings.length, 1);
  } finally { document.destroy(); }
});

test("OCR failure is local to a region; later text can still succeed", async () => {
  const processor = new TextRegionProcessor(2, { async recognize() {
    throw new TextProcessingError("OCR_FAILED", "Could not read this scan.");
  } });
  const scanned = openPdf(createTextFixture({ scanned: true }));
  const text = openPdf(createTextFixture());
  try {
    const failed = await processor.process(scanned, scanned.rasterizePage(0), TEXT_BOX);
    assert.deepEqual(failed, { kind: "text", status: "failed", error: { code: "OCR_FAILED", message: "Could not read this scan." } });
    assert.equal((await processor.process(text, text.rasterizePage(0), TEXT_BOX)).status, "processed");
  } finally { scanned.destroy(); text.destroy(); }
});

test("invalid OCR image returns a clear error and terminates its workers", { timeout: 15_000 }, async () => {
  await assert.rejects(new LocalTextRecognizer().recognize(new Uint8Array([1, 2, 3])),
    (error: unknown) => error instanceof TextProcessingError && error.code === "OCR_FAILED");
});

test("failed OCR language initialization reports failure and its owned worker can be stopped", { timeout: 15_000 }, async () => {
  const worker = new Worker(join(process.cwd(), "src/lib/phase2/ocr-worker.cjs"), {
    workerData: { png: new Uint8Array(), languagePath: join(process.cwd(), "tests/phase2/missing-language-fixture") },
  });
  try {
    const [message] = await once(worker, "message");
    assert.deepEqual(message, { failed: true });
  } finally {
    await worker.terminate();
  }
});
