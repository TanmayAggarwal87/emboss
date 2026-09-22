import * as mupdf from "mupdf";

import { UploadError } from "./errors.ts";
import { inspectTablePage } from "../table-processing/pdf-evidence.ts";
import { CLASSIFICATION_RASTER_SIZE, classificationTransform, validateRasterBox } from "./pdf-coordinates.ts";
import type {
  BoundingBox,
  PdfDocumentHandle,
  RasterizedPage,
} from "./types.ts";

export function openPdf(bytes: Uint8Array): PdfDocumentHandle {
  let document: mupdf.Document;

  try {
    document = mupdf.Document.openDocument(bytes, "application/pdf");
  } catch (error) {
    throw new UploadError(
      422,
      "INVALID_PDF",
      "This PDF could not be opened. It may be damaged or password-protected.",
      { cause: error },
    );
  }

  if (!document.isPDF() || document.needsPassword()) {
    document.destroy();
    throw new UploadError(
      422,
      "INVALID_PDF",
      "This PDF could not be opened. It may be damaged or password-protected.",
    );
  }

  return new MuPdfDocumentHandle(document);
}

class MuPdfDocumentHandle implements PdfDocumentHandle {
  readonly pageCount: number;

  constructor(private readonly document: mupdf.Document) {
    this.pageCount = document.countPages();
  }

  rasterizePage(pageIndex: number): RasterizedPage {
    const page = this.document.loadPage(pageIndex);

    try {
      const structuredText = page.toStructuredText("preserve-whitespace");
      let hasTextLayer: boolean;

      try {
        hasTextLayer = structuredText.asText().trim().length > 0;
      } finally {
        structuredText.destroy();
      }

      const pixmap = renderClassificationRaster(page);

      try {
        return {
          pageNumber: pageIndex + 1,
          width: pixmap.getWidth(),
          height: pixmap.getHeight(),
          pngBase64: Buffer.from(pixmap.asPNG()).toString("base64"),
          hasTextLayer,
        };
      } finally {
        pixmap.destroy();
      }
    } finally {
      page.destroy();
    }
  }

  destroy(): void {
    this.document.destroy();
  }

  inspectTableRegion(pageIndex: number, box: BoundingBox) {
    const page = this.document.loadPage(pageIndex);
    try {
      return inspectTablePage(page, box);
    } finally {
      page.destroy();
    }
  }

  extractTextRegion(pageIndex: number, box: BoundingBox): string {
    validateRasterBox(box);
    const page = this.document.loadPage(pageIndex);
    try {
      const [scale, , , , offsetX, offsetY] = classificationTransform(page);
      const structuredText = page.toStructuredText("preserve-whitespace");
      try {
        const blocks: string[] = [];
        let lines: string[] = [];
        let line = "";
        structuredText.walk({
          beginTextBlock() { lines = []; },
          beginLine() { line = ""; },
          onChar(character, _origin, _font, _size, quad) {
            const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4 * scale + offsetX;
            const y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4 * scale + offsetY;
            // Character centers scope both axes; copy(start,end) instead selects
            // a reading-order range and can leak text from neighboring columns.
            if (x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height) {
              line += character;
            }
          },
          endLine() { if (line.trim()) lines.push(line.trim()); },
          endTextBlock() { if (lines.length) blocks.push(lines.join("\n")); },
        });
        return blocks.join("\n\n");
      } finally {
        structuredText.destroy();
      }
    } finally {
      page.destroy();
    }
  }

  rasterizeRegion(pageIndex: number, box: BoundingBox): Uint8Array {
    validateRasterBox(box);
    const page = this.document.loadPage(pageIndex);
    try {
      // Rerender the source crop at twice classification resolution for OCR/Call B.
      // The output is bounded to 2000x2000 pixels regardless of PDF page size.
      const [scale, , , , offsetX, offsetY] = classificationTransform(page);
      const transform: mupdf.Matrix = [scale * 2, 0, 0, scale * 2,
        (offsetX - box.x) * 2, (offsetY - box.y) * 2];
      const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB,
        [0, 0, Math.ceil(box.width * 2), Math.ceil(box.height * 2)], false);
      try {
        pixmap.clear(255);
        const device = new mupdf.DrawDevice(mupdf.Matrix.identity, pixmap);
        try {
          page.run(device, transform);
          device.close();
          return Uint8Array.from(pixmap.asPNG());
        } finally {
          device.destroy();
        }
      } finally {
        pixmap.destroy();
      }
    } finally {
      page.destroy();
    }
  }
}

function renderClassificationRaster(page: mupdf.Page): mupdf.Pixmap {
  const transform = classificationTransform(page);
  const pixmap = new mupdf.Pixmap(
    mupdf.ColorSpace.DeviceRGB,
    [0, 0, CLASSIFICATION_RASTER_SIZE, CLASSIFICATION_RASTER_SIZE],
    false,
  );
  pixmap.clear(255);

  const device = new mupdf.DrawDevice(mupdf.Matrix.identity, pixmap);
  try {
    page.run(device, transform);
    device.close();
    return pixmap;
  } catch (error) {
    pixmap.destroy();
    throw error;
  } finally {
    device.destroy();
  }
}
