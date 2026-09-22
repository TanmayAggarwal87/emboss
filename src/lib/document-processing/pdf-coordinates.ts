import type { Matrix, Page } from "mupdf";

import type { BoundingBox } from "./types.ts";

export const CLASSIFICATION_RASTER_SIZE = 1000;

// Shared by rendering and text extraction. These are image coordinates, never
// physical/tactile dimensions. Page bounds already reflect CropBox and rotation.
export function classificationTransform(page: Page): Matrix {
  const [x0, y0, x1, y1] = page.getBounds();
  const width = x1 - x0;
  const height = y1 - y0;
  if (![x0, y0, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error("The PDF page has invalid dimensions.");
  }
  const scale = CLASSIFICATION_RASTER_SIZE / Math.max(width, height);
  return [
    scale, 0, 0, scale,
    (CLASSIFICATION_RASTER_SIZE - width * scale) / 2 - x0 * scale,
    (CLASSIFICATION_RASTER_SIZE - height * scale) / 2 - y0 * scale,
  ];
}

export function validateRasterBox(box: BoundingBox): void {
  const { x, y, width, height } = box;
  if (
    ![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 ||
    width <= 0 || height <= 0 || x + width > CLASSIFICATION_RASTER_SIZE ||
    y + height > CLASSIFICATION_RASTER_SIZE
  ) {
    throw new Error("The text region's box is outside the page raster.");
  }
}
