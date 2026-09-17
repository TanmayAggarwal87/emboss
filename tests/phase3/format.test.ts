import assert from "node:assert/strict";
import test from "node:test";

import { formatTable, validateTablePages } from "../../src/lib/phase3/format-table.ts";
import { TABLE_HEADERS, TABLE_ROWS } from "./fixtures.ts";

test("applies BANA alignment, three blank cells, header gap, guide dots and centered empty indicator", () => {
  const result = formatTable({ headers: TABLE_HEADERS, rows: TABLE_ROWS, structure: "ruled" }, 1);
  assert.equal(result.layout, "aligned");
  assert.deepEqual(result.column_alignment, ["left", "right"]);
  assert.equal(result.braille_rows[0][0], "⠠⠁⠍⠽");
  assert.equal(result.braille_rows[0][1], "⠼⠃");
  assert.equal(result.braille_rows[1][1], "⠤⠤");
  const lines = result.braille_pages[0].split("\n");
  assert.equal(lines[1], "");
  const width = result.column_widths_cells[0];
  for (const line of lines.filter(Boolean)) assert.equal(line.slice(width, width + 3), "   ");
  assert.equal(lines[2].endsWith("⠼⠃"), true);
  assert.match(lines[2].slice(0, width), /⠐ ⠐/);
  assert.doesNotMatch(lines[2], /⠐⠐/);
  const emptyWidth = result.column_widths_cells[1];
  assert.equal(lines[3].slice(width + 3), " ".repeat(Math.floor((emptyWidth - 2) / 2)) + "⠤⠤" + " ".repeat(Math.ceil((emptyWidth - 2) / 2)));
  assert.ok(lines.every((line) => line.length <= 40));
});

test("wide tables become bounded vertical lists without dropping any cells", () => {
  const result = formatTable({ headers: ["Long first column heading", "Long second column heading"],
    rows: [["The cat and the dog", "The sun and the moon"]], structure: "ruled" }, 1);
  assert.equal(result.layout, "vertical_list");
  assert.equal(result.braille_pages.length, 1);
  assert.equal(result.braille_rows.length, 1);
  assert.ok(result.braille_pages[0].split("\n").every((line) => line.length <= 40));
});

test("long tables repeat headers in sections of at most 25 lines", () => {
  const result = formatTable({ headers: ["Name", "Count"], rows: Array.from({ length: 30 }, () => ["Amy", "2"]), structure: "ruled" }, 2);
  assert.equal(result.braille_pages.length, 2);
  assert.equal(result.braille_pages[0].split("\n").length, 25);
  assert.equal(result.braille_pages[1].split("\n")[0], result.braille_pages[0].split("\n")[0]);
  assert.equal(result.braille_pages[1].split("\n")[1], "");
});

test("never emits overlong values, non-rectangular data or invalid braille layout", () => {
  assert.throws(() => formatTable({ headers: ["Name", "Count"], rows: [["x".repeat(100), "1"]], structure: "ruled" }, 1), /longer than 40/);
  assert.throws(() => formatTable({ headers: ["Name", "Count"], rows: [["Amy"]], structure: "ruled" }, 1), /rectangular/);
  assert.throws(() => validateTablePages(["⠁".repeat(41)]), /page limits/);
});
