import * as mupdf from "mupdf";
import type { SupportedDiagramData } from "../../src/lib/diagram-extraction/schema.ts";

export const CHART_BOX = { x: 40, y: 50, width: 920, height: 920 };
export const EXPECTED_CHARTS: SupportedDiagramData[] = [
  { chart_type: "bar_chart", orientation: "vertical", independent_axis: { type: "categorical", values: ["Jan", "Feb", "Mar"] }, axis_labels: { x: "Month", y: "Count" }, series_label: "Monthly totals",
    data_points: [{ label: "Jan", value: 10 }, { label: "Feb", value: 20 }, { label: "Mar", value: 30 }] },
  { chart_type: "line_graph_single_series", independent_axis: { type: "categorical", values: ["Jan", "Feb", "Mar"] }, axis_labels: { x: "Month", y: "Count" }, series_label: "Monthly trend",
    data_points: [{ label: "Jan", value: 5 }, { label: "Feb", value: 15 }, { label: "Mar", value: 10 }] },
];

// Known source values and labels, with one chart per page. No AI-generated fixture.
export function createDiagramFixture(): Uint8Array {
  const pdf = new mupdf.PDFDocument();
  const font = new mupdf.Font("Helvetica");
  const fontRef = pdf.addSimpleFont(font);
  try {
    for (const chart of EXPECTED_CHARTS) {
      const content = ["0 0 0 RG 0 0 0 rg 2 w 70 480 m 70 80 l 540 80 l S",
        text(230, 550, chart.series_label!), text(60, 510, "Count"), text(270, 35, "Month"),
        text(15, 5, "OUTSIDE CROP")];
      for (let value = 0; value <= 40; value += 10) {
        content.push(`65 ${80 + value * 10} m 70 ${80 + value * 10} l S`, text(40, 75 + value * 10, String(value)));
      }
      chart.data_points.forEach((point, index) => {
        const x = 150 + index * 150;
        const y = 80 + point.value! * 10;
        content.push(text(x - 10, 60, point.label), text(x - 5, y + 15, String(point.value)));
        if (chart.chart_type === "bar_chart") content.push(`0.2 0.4 0.7 rg ${x - 25} 80 50 ${y - 80} re f 0 0 0 rg`);
        else content.push(`${x - 3} ${y - 3} 6 6 re f`);
      });
      if (chart.chart_type === "line_graph_single_series") {
        content.push("3 w 150 130 m 300 230 l 450 180 l S");
      }
      const page = pdf.addPage([0, 0, 600, 600], 0, { Font: { F1: fontRef } }, content.join("\n"));
      try { pdf.insertPage(-1, page); } finally { page.destroy(); }
    }
    const buffer = pdf.saveToBuffer("compress");
    try { return Uint8Array.from(buffer.asUint8Array()); } finally { buffer.destroy(); }
  } finally { fontRef.destroy(); font.destroy(); pdf.destroy(); }
}

function text(x: number, y: number, value: string): string {
  return `BT /F1 14 Tf ${x} ${y} Td (${value}) Tj ET`;
}
