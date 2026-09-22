import * as mupdf from "mupdf";

export const REFERENCE_TEXT = "The cat and the dog.";
export const REFERENCE_GRADE_1 = "⠠⠞⠓⠑ ⠉⠁⠞ ⠁⠝⠙ ⠞⠓⠑ ⠙⠕⠛⠲";
export const REFERENCE_GRADE_2 = "⠠⠮ ⠉⠁⠞ ⠯ ⠮ ⠙⠕⠛⠲";

// Fixed expected cells, not generated using the translator being tested. UEB
// whole-word contractions: the = 2346, and = 12346 (liblouis en-ueb-g2.ctb).
export function createTextFixture(options: { scanned?: boolean; rotation?: 0 | 90 | 180 | 270; crop?: boolean } = {}): Uint8Array {
  const pdf = new mupdf.PDFDocument();
  const font = new mupdf.Font("Helvetica");
  const fontRef = pdf.addSimpleFont(font);
  try {
    for (let index = 0; index < 2; index += 1) {
      const content = [
        `BT /F1 18 Tf 60 720 Td (${REFERENCE_TEXT}) Tj ET`,
        "BT /F1 18 Tf 350 720 Td (NEIGHBOR COLUMN) Tj ET",
        "BT /F1 18 Tf 60 520 Td (OUTSIDE BELOW) Tj ET",
        "0 0 0 rg 60 100 40 80 re f 130 100 40 140 re f",
      ].join("\n");
      const pageObject = pdf.addPage([0, 0, 612, 792], options.rotation ?? 0, { Font: { F1: fontRef } }, content);
      if (options.crop) pageObject.put("CropBox", [30, 30, 582, 762]);
      pdf.insertPage(-1, pageObject);
      pageObject.destroy();
    }
    if (options.scanned) {
      const scanned = new mupdf.PDFDocument();
      try {
        for (let index = 0; index < 2; index += 1) {
          const page = pdf.loadPage(index);
          const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false);
          const image = new mupdf.Image(pixmap);
          const imageRef = scanned.addImage(image);
          try {
            const obj = scanned.addPage([0, 0, 612, 792], 0, { XObject: { Im1: imageRef } }, "q 612 0 0 792 0 0 cm /Im1 Do Q");
            scanned.insertPage(-1, obj);
            obj.destroy();
          } finally {
            imageRef.destroy(); image.destroy(); pixmap.destroy(); page.destroy();
          }
        }
        return save(scanned);
      } finally { scanned.destroy(); }
    }
    return save(pdf);
  } finally { fontRef.destroy(); font.destroy(); pdf.destroy(); }
}

function save(pdf: mupdf.PDFDocument): Uint8Array {
  const buffer = pdf.saveToBuffer("compress");
  try { return Uint8Array.from(buffer.asUint8Array()); } finally { buffer.destroy(); }
}

// Portrait PDF coordinates independently mapped into the fixed 1000px raster:
// x padding is (1000 - 612*1000/792)/2, y is measured down from the top.
export const TEXT_BOX = { x: 180, y: 55, width: 300, height: 50 };
