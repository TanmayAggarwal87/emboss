import * as mupdf from "mupdf";

import { UploadError } from "./errors.ts";
import type {
  PdfDocumentHandle,
  RasterizedPage,
} from "./types.ts";

const CLASSIFICATION_RASTER_SIZE = 1000;

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
}

function renderClassificationRaster(page: mupdf.Page): mupdf.Pixmap {
  const [x0, y0, x1, y1] = page.getBounds();
  const pageWidth = x1 - x0;
  const pageHeight = y1 - y0;
  const scale = Math.min(
    CLASSIFICATION_RASTER_SIZE / pageWidth,
    CLASSIFICATION_RASTER_SIZE / pageHeight,
  );
  const offsetX = (CLASSIFICATION_RASTER_SIZE - pageWidth * scale) / 2;
  const offsetY = (CLASSIFICATION_RASTER_SIZE - pageHeight * scale) / 2;
  const transform: mupdf.Matrix = [
    scale,
    0,
    0,
    scale,
    offsetX - x0 * scale,
    offsetY - y0 * scale,
  ];
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
