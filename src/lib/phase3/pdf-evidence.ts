import * as mupdf from "mupdf";

import { classificationTransform, validateRasterBox } from "../phase1/pdf-coordinates.ts";
import type { BoundingBox } from "../phase1/types.ts";
import { TableProcessingError, type Rectangle, type TableEvidence } from "./types.ts";

// Image-space tolerances, not BANA/physical measurements.
const AXIS_TOLERANCE_PX = 0.75;
const MAX_EVIDENCE_ITEMS = 20_000;

export function inspectTablePage(page: mupdf.Page, box: BoundingBox): TableEvidence {
  validateRasterBox(box);
  const transform = classificationTransform(page);
  const area: Rectangle = [box.x, box.y, box.x + box.width, box.y + box.height];
  const evidence: TableEvidence = {
    characters: [], images: [], horizontal: [], vertical: [], clippedText: false, rotatedText: false,
  };
  const text = page.toStructuredText("preserve-whitespace,preserve-spans,preserve-images");
  let line = 0;
  let rotated = false;
  try {
    text.walk({
      beginLine(_bounds, writingMode, direction) {
        line += 1;
        rotated = writingMode !== 0 || Math.abs(direction[1]) > 0.01 || direction[0] < 0;
      },
      onChar(character, _origin, font, _size, quad) {
        const bounds = mupdf.Rect.transform([
          Math.min(quad[0], quad[2], quad[4], quad[6]),
          Math.min(quad[1], quad[3], quad[5], quad[7]),
          Math.max(quad[0], quad[2], quad[4], quad[6]),
          Math.max(quad[1], quad[3], quad[5], quad[7]),
        ], transform);
        if (!intersects(bounds, area) || !character.trim()) return;
        if (!contains(area, bounds, AXIS_TOLERANCE_PX)) evidence.clippedText = true;
        evidence.rotatedText ||= rotated;
        evidence.characters.push({ text: character, bounds, line, bold: /bold|black|heavy/i.test(font.getName()) });
        checkSize();
      },
      onImageBlock(bounds) {
        const rasterBounds = mupdf.Rect.transform(bounds, transform);
        if (intersects(rasterBounds, area)) evidence.images.push(rasterBounds);
        checkSize();
      },
    });
  } finally {
    text.destroy();
  }

  function addSegment(a: mupdf.Point, b: mupdf.Point) {
    if (!intersects([Math.min(a[0], b[0]) - AXIS_TOLERANCE_PX,
      Math.min(a[1], b[1]) - AXIS_TOLERANCE_PX,
      Math.max(a[0], b[0]) + AXIS_TOLERANCE_PX,
      Math.max(a[1], b[1]) + AXIS_TOLERANCE_PX], area)) return;
    if (Math.abs(a[1] - b[1]) <= AXIS_TOLERANCE_PX && Math.abs(a[0] - b[0]) > AXIS_TOLERANCE_PX) {
      evidence.horizontal.push({ position: (a[1] + b[1]) / 2, start: Math.min(a[0], b[0]), end: Math.max(a[0], b[0]) });
    } else if (Math.abs(a[0] - b[0]) <= AXIS_TOLERANCE_PX && Math.abs(a[1] - b[1]) > AXIS_TOLERANCE_PX) {
      evidence.vertical.push({ position: (a[0] + b[0]) / 2, start: Math.min(a[1], b[1]), end: Math.max(a[1], b[1]) });
    }
    checkSize();
  }
  const device = new mupdf.Device({
    strokePath(path, _stroke, matrix, _space, _color, alpha) {
      if (alpha <= 0) return;
      let previous: mupdf.Point | undefined;
      let start: mupdf.Point | undefined;
      path.walk({
        moveTo(x, y) { previous = start = point(x, y, matrix); },
        lineTo(x, y) {
          const next = point(x, y, matrix);
          if (previous) addSegment(previous, next);
          previous = next;
        },
        curveTo(_a, _b, _c, _d, x, y) { previous = point(x, y, matrix); },
        closePath() { if (previous && start) addSegment(previous, start); previous = start; },
      });
    },
    fillPath(path, _evenOdd, matrix, _space, _color, alpha) {
      if (alpha <= 0) return;
      const points: mupdf.Point[] = [];
      let curved = false;
      path.walk({
        moveTo(x, y) { points.push(point(x, y, matrix)); },
        lineTo(x, y) { points.push(point(x, y, matrix)); },
        curveTo() { curved = true; },
      });
      if (curved || points.length < 4 || points.length > 5) return;
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      // Many PDF generators draw ruling as thin filled rectangles.
      if (bottom - top <= 2 * AXIS_TOLERANCE_PX) addSegment([left, (top + bottom) / 2], [right, (top + bottom) / 2]);
      else if (right - left <= 2 * AXIS_TOLERANCE_PX) addSegment([(left + right) / 2, top], [(left + right) / 2, bottom]);
    },
  });
  try {
    page.run(device, transform);
    device.close();
  } finally {
    device.destroy();
  }
  return evidence;

  function checkSize() {
    if (evidence.characters.length + evidence.images.length + evidence.horizontal.length + evidence.vertical.length > MAX_EVIDENCE_ITEMS) {
      throw new TableProcessingError("TABLE_TOO_COMPLEX", "This table has too much detail to extract safely in v1.");
    }
  }
}

function point(x: number, y: number, matrix: mupdf.Matrix): mupdf.Point {
  return [x * matrix[0] + y * matrix[2] + matrix[4], x * matrix[1] + y * matrix[3] + matrix[5]];
}

export function intersects(a: Rectangle, b: Rectangle): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

export function contains(outer: Rectangle, inner: Rectangle, tolerance = 0): boolean {
  return inner[0] >= outer[0] - tolerance && inner[1] >= outer[1] - tolerance &&
    inner[2] <= outer[2] + tolerance && inner[3] <= outer[3] + tolerance;
}
