import { contains } from "./pdf-evidence.ts";
import { TableProcessingError, type PlainTable, type Rule, type TableCharacter, type TableEvidence } from "./types.ts";

// Tolerance for coincident PDF strokes in classification pixels, not millimeters.
const RULE_TOLERANCE_PX = 1.5;

export function extractTable(evidence: TableEvidence): PlainTable {
  if (evidence.clippedText) fail("TABLE_CLIPPED", "The detected table box cuts through text. Please use a complete table region.");
  if (evidence.rotatedText) fail("TABLE_ROTATED", "Rotated or vertical table text is not supported yet.");
  if (!evidence.characters.length) fail("TABLE_EMPTY", "No readable table text was found in this region.");
  const words = textRuns(evidence.characters);
  const joined = words.map((word) => word.text).join(" ");
  if (/stem\s*(?:[-–—]\s*|and\s*)?leaf|punnett/i.test(joined)) {
    fail("TABLE_UNSUPPORTED_CONTENT", "Stem-and-leaf plots and Punnett squares are not supported by the table pipeline.");
  }
  const xs = coordinates(evidence.vertical);
  const ys = coordinates(evidence.horizontal);
  let cells: TableCharacter[][][];
  let structure: PlainTable["structure"];
  if (xs.length || ys.length) {
    structure = "ruled";
    if (xs.length < 3 || ys.length < 3 || xs.length > 41 || ys.length > 101) {
      fail("TABLE_GRID_UNSUPPORTED", "This table needs a complete rectangular grid with at least two columns and one data row. Partial grids and perimeter-less Punnett layouts are not supported.");
    }
    if (xs.some((x) => !covered(evidence.vertical, x, ys[0], ys.at(-1)!)) ||
        ys.some((y) => !covered(evidence.horizontal, y, xs[0], xs.at(-1)!))) {
      fail("TABLE_MERGED_CELLS", "This table has merged cells or incomplete ruling. Use a simple rectangular table without merged cells.");
    }
    cells = Array.from({ length: ys.length - 1 }, () => Array.from({ length: xs.length - 1 }, () => [] as TableCharacter[]));
    for (const character of evidence.characters) {
      const x = (character.bounds[0] + character.bounds[2]) / 2;
      const y = (character.bounds[1] + character.bounds[3]) / 2;
      const column = xs.findIndex((edge, index) => index < xs.length - 1 && x > edge && x < xs[index + 1]);
      const row = ys.findIndex((edge, index) => index < ys.length - 1 && y > edge && y < ys[index + 1]);
      if (row < 0 || column < 0 || !contains([xs[column], ys[row], xs[column + 1], ys[row + 1]], character.bounds, RULE_TOLERANCE_PX)) {
        fail("TABLE_CELL_OVERLAP", "Text crosses a table boundary or includes a caption outside the grid. Check the detected table box.");
      }
      cells[row][column].push(character);
    }
  } else {
    structure = "aligned";
    const rows = groupLines(evidence.characters);
    const split = rows.map(splitColumns);
    const count = split[0]?.length ?? 0;
    if (count < 2 || rows.length < 2 || split.some((row) => row.length !== count)) {
      fail("TABLE_ALIGNMENT_AMBIGUOUS", "This unruled table has ambiguous columns, missing cells, or merged cells. Use a consistently aligned table or a complete rectangular grid.");
    }
    // There must be a shared, empty vertical gutter between every pair of columns.
    for (let column = 0; column < count - 1; column += 1) {
      const right = Math.max(...split.map((row) => Math.max(...row[column].map((c) => c.bounds[2]))));
      const left = Math.min(...split.map((row) => Math.min(...row[column + 1].map((c) => c.bounds[0]))));
      if (right >= left) fail("TABLE_ALIGNMENT_AMBIGUOUS", "This table's columns overlap or shift between rows.");
    }
    cells = split;
  }
  const values = cells.map((row) => row.map(cellText));
  if (values[0].some((cell) => !cell)) fail("TABLE_HEADER_MISSING", "Every column needs a non-empty header in one header row.");
  if (cells[0].some((cell) => groupLines(cell).length > 1) || cells.slice(1).some((row) =>
    row.every((cell) => cell.length > 0 && cell.every((char) => char.bold)))) {
    fail("TABLE_MULTIPLE_HEADERS", "Multiple or ambiguous header rows are not supported. Use one clearly identified header row.");
  }
  // Recognize common unlabeled exclusion shapes as well as named examples.
  if (values[0].some((cell) => /^(stem|leaf|leaves)$/i.test(cell)) ||
      values.slice(1).every((row) => row.length === 2 && /^\d+$/.test(row[0]) && /^\d(?:\s+\d)+$/.test(row[1])) ||
      (values.length === 3 && values[0].length === 3 &&
       values[0].slice(1).every((cell) => /^[A-Za-z]$/.test(cell)) &&
       values.slice(1).every((row) => /^[A-Za-z]$/.test(row[0]) && row.slice(1).every((cell) => /^[A-Za-z]{2}$/.test(cell))))) {
    fail("TABLE_UNSUPPORTED_CONTENT", "This looks like a stem-and-leaf plot or a Punnett square, which is outside the supported table scope.");
  }
  return { headers: values[0], rows: values.slice(1), structure };
}

function coordinates(rules: Rule[]): number[] {
  const values: number[] = [];
  for (const rule of [...rules].sort((a, b) => a.position - b.position)) {
    if (!values.length || rule.position - values.at(-1)! > RULE_TOLERANCE_PX) values.push(rule.position);
  }
  return values;
}

function covered(rules: Rule[], position: number, start: number, end: number): boolean {
  const matching = rules.filter((rule) => Math.abs(rule.position - position) <= RULE_TOLERANCE_PX)
    .sort((a, b) => a.start - b.start);
  let until = start;
  for (const rule of matching) {
    if (rule.start > until + RULE_TOLERANCE_PX) return false;
    until = Math.max(until, rule.end);
  }
  return until >= end - RULE_TOLERANCE_PX;
}

function groupLines(characters: TableCharacter[]): TableCharacter[][] {
  const lines: TableCharacter[][] = [];
  for (const character of [...characters].sort((a, b) => a.bounds[1] - b.bounds[1] || a.bounds[0] - b.bounds[0])) {
    const center = (character.bounds[1] + character.bounds[3]) / 2;
    const line = lines.find((row) => {
      const first = row[0];
      return Math.abs(center - (first.bounds[1] + first.bounds[3]) / 2) <
        Math.min(character.bounds[3] - character.bounds[1], first.bounds[3] - first.bounds[1]) * 0.4;
    });
    if (line) line.push(character); else lines.push([character]);
  }
  return lines.map((line) => line.sort((a, b) => a.bounds[0] - b.bounds[0]));
}

function splitColumns(characters: TableCharacter[]): TableCharacter[][] {
  const widths = characters.map((c) => c.bounds[2] - c.bounds[0]).sort((a, b) => a - b);
  const gapThreshold = widths[Math.floor(widths.length / 2)] * 2;
  const cells: TableCharacter[][] = [];
  for (const character of characters) {
    const cell = cells.at(-1);
    if (!cell || character.bounds[0] - cell.at(-1)!.bounds[2] > gapThreshold) cells.push([character]);
    else cell.push(character);
  }
  return cells;
}

function cellText(characters: TableCharacter[]): string {
  return groupLines(characters).map((line) => {
    let text = "";
    let previous: TableCharacter | undefined;
    for (const character of line) {
      if (previous && character.bounds[0] - previous.bounds[2] >
          Math.min(character.bounds[2] - character.bounds[0], previous.bounds[2] - previous.bounds[0]) * 0.25) text += " ";
      text += character.text;
      previous = character;
    }
    return text;
  }).join(" ").trim();
}

function textRuns(characters: TableCharacter[]) {
  return groupLines(characters).map((line) => ({ text: cellText(line) }));
}

function fail(code: string, message: string): never {
  throw new TableProcessingError(code, message);
}
