import "server-only";

import { translateBraille } from "../phase2/braille.ts";
import type { BrailleGrade } from "../phase2/types.ts";
import { BANA_TABLE_RULES as rules } from "./table-rules.ts";
import { TableProcessingError, type PlainTable, type TableRegionResult } from "./types.ts";

type FormattedTable = Extract<TableRegionResult, { status: "processed" }>;

export function formatTable(table: PlainTable, grade: BrailleGrade): FormattedTable {
  const { headers, rows } = table;
  if (headers.length < 2 || rows.length < 1 || headers.some((cell) => !cell.trim()) ||
      rows.some((row) => row.length !== headers.length)) {
    throw new TableProcessingError("TABLE_SHAPE_INVALID", "Use a rectangular table with one non-empty header per column.");
  }
  const translated = headers.map((text) => translateBraille(text, grade));
  const brailleHeaders = translated.map((result) => result.braille);
  const brailleRows = rows.map((row) => row.map((text) => text.trim() ? translateBraille(text, grade).braille : rules.emptyCell));
  const widths = headers.map((_header, column) => Math.max(rules.emptyCell.length,
    brailleHeaders[column].length, ...brailleRows.map((row) => row[column].length)));
  const alignment = headers.map((_header, column): "left" | "right" => {
    const values = rows.map((row) => row[column].trim()).filter(Boolean);
    return values.length > 0 && values.every(isNumeric) ? "right" : "left";
  });
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * rules.columnGapCells;
  const layout = totalWidth <= rules.maxLineCells ? "aligned" : "vertical_list";
  const pages = layout === "aligned"
    ? alignedPages(brailleHeaders, brailleRows, rows, widths, alignment)
    : verticalPages(brailleHeaders, brailleRows, grade);
  validateTablePages(pages);
  return {
    kind: "table", status: "processed", source: "text_layer", headers, rows,
    braille_headers: brailleHeaders, braille_rows: brailleRows, braille_pages: pages,
    layout, column_widths_cells: widths, column_alignment: alignment,
    braille_grade: grade, braille_code: "UEB", translation_table: translated[0].table,
    liblouis_version: translated[0].version,
    warnings: ["The first row is treated as the column header. Verify the cell structure and header row before approval.",
      ...(layout === "vertical_list" ? ["The table is too wide for 40 cells and has been formatted as a vertical list."] : [])],
  };
}

function alignedPages(headers: string[], rows: string[][], sourceRows: string[][],
  widths: number[], alignment: ("left" | "right")[]): string[] {
  const gap = " ".repeat(rules.columnGapCells);
  const header = headers.map((text, index) => text.padEnd(widths[index])).join(gap);
  const lines = rows.map((row, rowIndex) => row.map((text, column) => {
    const extra = widths[column] - text.length;
    if (!sourceRows[rowIndex][column].trim()) {
      const left = Math.floor(extra / 2);
      return " ".repeat(left) + text + " ".repeat(extra - left);
    }
    if (alignment[column] === "right") return text.padStart(widths[column]);
    // Guide dots live in spare column padding, never in the mandatory three
    // blank cells separating columns. Each dot has one blank cell beside it.
    return text + (column < widths.length - 1 ? guidePadding(extra) : " ".repeat(extra));
  }).join(gap));
  const capacity = rules.maxPageLines - 1 - rules.blankLinesAfterHeader;
  const pages: string[] = [];
  for (let offset = 0; offset < lines.length; offset += capacity) {
    pages.push([header, ...Array<string>(rules.blankLinesAfterHeader).fill(""),
      ...lines.slice(offset, offset + capacity)].join("\n"));
  }
  return pages;
}

function guidePadding(length: number): string {
  const blank = " ".repeat(rules.blankCellsBetweenGuideDots);
  if (length < blank.length * 2 + 1) return " ".repeat(length);
  let result = blank;
  while (result.length + 1 + blank.length <= length) result += rules.guideDot + blank;
  return result.padEnd(length);
}

function verticalPages(headers: string[], rows: string[][], grade: BrailleGrade): string[] {
  const separator = translateBraille(": ", grade).braille;
  const pages: string[] = [];
  let current: string[] = [];
  for (const row of rows) {
    const lines = row.flatMap((cell, column) => wrap(`${headers[column]}${separator}${cell}`));
    if (lines.length > rules.maxPageLines) {
      throw new TableProcessingError("TABLE_ROW_TOO_LARGE", "One table row is too long for the supported braille page. Please simplify this table.");
    }
    const separatorLines = current.length ? 1 : 0;
    if (current.length + separatorLines + lines.length > rules.maxPageLines) {
      pages.push(current.join("\n"));
      current = [];
    }
    if (current.length) current.push("");
    current.push(...lines);
  }
  if (current.length) pages.push(current.join("\n"));
  return pages;
}

function wrap(text: string): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/ +/u)) {
    if (word.length > rules.maxLineCells) {
      throw new TableProcessingError("TABLE_CELL_TOO_WIDE", "A table cell contains an unbroken value longer than 40 braille cells. Please shorten it.");
    }
    if (line && line.length + 1 + word.length > rules.maxLineCells) {
      lines.push(line);
      line = "";
    }
    line += (line ? " " : "") + word;
  }
  if (line) lines.push(line);
  return lines;
}

export function validateTablePages(pages: string[]): void {
  if (!pages.length || pages.some((page) => !page || !/^[\u2800-\u283f \n]+$/u.test(page) ||
      page.split("\n").length > rules.maxPageLines || page.split("\n").some((line) => line.length > rules.maxLineCells))) {
    throw new TableProcessingError("TABLE_LAYOUT_INVALID", "The braille table could not be laid out within the supported page limits.");
  }
}

function isNumeric(text: string): boolean {
  return /^[+−-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text);
}
