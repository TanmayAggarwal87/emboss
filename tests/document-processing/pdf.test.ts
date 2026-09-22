import assert from "node:assert/strict";
import test from "node:test";

import * as mupdf from "mupdf";

import { openPdf } from "../../src/lib/document-processing/pdf.ts";

test("MuPDF counts, rasterizes, and detects a real text layer", () => {
  const bytes = createTwoPageFixture();
  const document = openPdf(bytes);

  try {
    assert.equal(document.pageCount, 2);

    const firstPage = document.rasterizePage(0);
    assert.equal(firstPage.pageNumber, 1);
    assert.equal(firstPage.hasTextLayer, true);
    assert.equal(firstPage.width, 1000);
    assert.equal(firstPage.height, 1000);

    const pngHeader = Buffer.from(firstPage.pngBase64, "base64").subarray(0, 8);
    assert.deepEqual(
      [...pngHeader],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    );

    const secondPage = document.rasterizePage(1);
    assert.equal(secondPage.hasTextLayer, false);
  } finally {
    document.destroy();
  }
});

function createTwoPageFixture(): Uint8Array {
  const document = new mupdf.PDFDocument();
  const font = new mupdf.Font("Helvetica");
  const fontReference = document.addSimpleFont(font);
  const resources = { Font: { F1: fontReference } };

  for (let pageIndex = 0; pageIndex < 2; pageIndex += 1) {
    const content = [
      pageIndex === 0
        ? "BT /F1 24 Tf 72 720 Td (Accessible lesson text) Tj ET"
        : "",
      "0 0 0 rg",
      "100 100 40 120 re f",
      "180 100 40 200 re f",
      "260 100 40 160 re f",
    ].join("\n");
    const page = document.addPage([0, 0, 612, 792], 0, resources, content);
    document.insertPage(-1, page);
    page.destroy();
  }

  const buffer = document.saveToBuffer("compress");
  const bytes = Uint8Array.from(buffer.asUint8Array());

  buffer.destroy();
  fontReference.destroy();
  font.destroy();
  document.destroy();
  return bytes;
}
