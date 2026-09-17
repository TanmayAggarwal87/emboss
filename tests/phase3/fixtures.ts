import * as mupdf from "mupdf";

export const TABLE_HEADERS = ["Name", "Count"];
export const TABLE_ROWS = [["Amy", "2"], ["Bob", ""], ["Christopher", "12"]];
export const TABLE_BOX = { x: 175, y: 100, width: 650, height: 310 };
export type FixtureMode = "ruled" | "aligned" | "merged" | "multi_header" |
  "stem_leaf" | "punnett" | "image" | "mixed_image" | "filled_rules";

export function createTableFixture(modes: FixtureMode[] = ["ruled", "ruled"]): Uint8Array {
  const pdf = new mupdf.PDFDocument();
  const normal = new mupdf.Font("Helvetica");
  const bold = new mupdf.Font("Helvetica-Bold");
  const normalRef = pdf.addSimpleFont(normal);
  const boldRef = pdf.addSimpleFont(bold);
  const resources = { Font: { F1: normalRef, F2: boldRef } };
  try {
    for (const mode of modes) {
      const header = mode === "stem_leaf" ? ["Stem", "Leaf"] : TABLE_HEADERS;
      const rows = mode === "aligned" ? [["Amy", "2"], ["Bob", "3"], ["Christopher", "12"]] : TABLE_ROWS;
      const content: string[] = [];
      const yLines = [700, 645, 590, 535, 480];
      if (mode !== "aligned") {
        content.push("0 G 1 w");
        for (const y of yLines) {
          content.push(mode === "filled_rules" ? `60 ${y - 0.3} 492 0.6 re f` : `60 ${y} m 552 ${y} l S`);
        }
        for (const x of [60, 310, 552]) {
          if (mode === "punnett" && x !== 310) continue;
          const startY = mode === "merged" && x === 310 ? 645 : 700;
          content.push(mode === "filled_rules" ? `${x - 0.3} 480 0.6 220 re f` : `${x} ${startY} m ${x} 480 l S`);
        }
      }
      for (const [rowIndex, row] of [header, ...rows].entries()) {
        for (const [column, value] of row.entries()) {
          if (!value) continue;
          const font = rowIndex === 0 || (mode === "multi_header" && rowIndex === 1) ? "F2" : "F1";
          const x = column === 0 ? 75 : 335;
          content.push(`BT /${font} 16 Tf ${x} ${665 - rowIndex * 55} Td (${value}) Tj ET`);
        }
      }
      const pageObject = pdf.addPage([0, 0, 612, 792], 0, resources, content.join("\n"));
      pdf.insertPage(-1, pageObject);
      pageObject.destroy();
      if (mode === "image" || mode === "mixed_image") {
        const index = pdf.countPages() - 1;
        const page = pdf.loadPage(index);
        const pixmap = page.toPixmap(mupdf.Matrix.scale(1, 1), mupdf.ColorSpace.DeviceRGB, false);
        const image = new mupdf.Image(pixmap);
        const ref = pdf.addImage(image);
        try {
          pdf.deletePage(index);
          const imagePage = pdf.addPage([0, 0, 612, 792], 0,
            { XObject: { Im: ref }, Font: { F1: normalRef } },
            "q 612 0 0 792 0 0 cm /Im Do Q\n" + (mode === "mixed_image"
              ? "BT /F1 18 Tf 60 750 Td (Selectable heading outside table) Tj ET" : ""));
          pdf.insertPage(-1, imagePage);
          imagePage.destroy();
        } finally { ref.destroy(); image.destroy(); pixmap.destroy(); page.destroy(); }
      }
    }
    const buffer = pdf.saveToBuffer("compress");
    try { return Uint8Array.from(buffer.asUint8Array()); } finally { buffer.destroy(); }
  } finally {
    normalRef.destroy(); boldRef.destroy(); normal.destroy(); bold.destroy(); pdf.destroy();
  }
}
