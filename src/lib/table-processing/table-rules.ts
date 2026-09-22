// Source of truth: docs/bana-standards.md §1 (page cells/lines) and §8
// (column separation, heading gap, guide dots and empty-cell indicator).
// No cell-to-mm conversion or physical geometry is introduced in Phase 3.
export const BANA_TABLE_RULES = Object.freeze({
  maxLineCells: 40,
  maxPageLines: 25,
  columnGapCells: 3,
  blankLinesAfterHeader: 1,
  guideDot: "⠐",
  blankCellsBetweenGuideDots: 1,
  emptyCell: "⠤⠤",
});
