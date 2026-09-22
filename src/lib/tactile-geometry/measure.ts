import { BRAILLE } from "./profile.ts";
import type { GeometryElement, Segment, XY } from "./types.ts";

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
export function brailleSize(braille: string): { width: number; height: number } {
  const lines = braille.split("\n");
  return { width: (Math.max(...lines.map((line) => line.length)) - 1) * BRAILLE.cellPitch + BRAILLE.dotPitch + BRAILLE.dotDiameter,
    height: (lines.length - 1) * BRAILLE.linePitch + 2 * BRAILLE.dotPitch + BRAILLE.dotDiameter };
}
export function bounds(element: GeometryElement): Bounds {
  if (element.kind === "line") {
    const coords = element.segments.flatMap((s) => [s.from, s.to]);
    const r = element.width / 2;
    return { minX: Math.min(...coords.map((p) => p[0])) - r, minY: Math.min(...coords.map((p) => p[1])) - r,
      maxX: Math.max(...coords.map((p) => p[0])) + r, maxY: Math.max(...coords.map((p) => p[1])) + r };
  }
  if (element.kind === "point") return { minX: element.x - element.size / 2, minY: element.y - element.size / 2,
    maxX: element.x + element.size / 2, maxY: element.y + element.size / 2 };
  return { minX: element.x, minY: element.y, maxX: element.x + element.width, maxY: element.y + element.height };
}
export function rectDistance(a: Bounds, b: Bounds): number {
  return Math.hypot(Math.max(0, a.minX - b.maxX, b.minX - a.maxX), Math.max(0, a.minY - b.maxY, b.minY - a.maxY));
}
export function pointSegmentDistance(p: XY, s: Segment): number {
  const dx = s.to[0] - s.from[0], dy = s.to[1] - s.from[1];
  const t = Math.max(0, Math.min(1, ((p[0] - s.from[0]) * dx + (p[1] - s.from[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - s.from[0] - t * dx, p[1] - s.from[1] - t * dy);
}
export function segmentDistance(a: Segment, b: Segment): number {
  const cross = (p: XY, q: XY, r: XY) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const c1 = cross(a.from, a.to, b.from), c2 = cross(a.from, a.to, b.to);
  const c3 = cross(b.from, b.to, a.from), c4 = cross(b.from, b.to, a.to);
  if (c1 * c2 < 0 && c3 * c4 < 0) return 0;
  return Math.min(pointSegmentDistance(a.from, b), pointSegmentDistance(a.to, b),
    pointSegmentDistance(b.from, a), pointSegmentDistance(b.to, a));
}
function segmentRectDistance(s: Segment, r: Bounds): number {
  const inside = (p: XY) => p[0] >= r.minX && p[0] <= r.maxX && p[1] >= r.minY && p[1] <= r.maxY;
  if (inside(s.from) || inside(s.to)) return 0;
  const corners: XY[] = [[r.minX, r.minY], [r.maxX, r.minY], [r.maxX, r.maxY], [r.minX, r.maxY]];
  return Math.min(...corners.map((p, i) => segmentDistance(s, { from: p, to: corners[(i + 1) % 4] })));
}
export function elementDistance(a: GeometryElement, b: GeometryElement): number {
  if (a.kind === "line" && b.kind === "line") return Math.max(0,
    Math.min(...a.segments.flatMap((s) => b.segments.map((t) => segmentDistance(s, t)))) - (a.width + b.width) / 2);
  if (a.kind === "line") return Math.max(0, Math.min(...a.segments.map((s) => segmentRectDistance(s, bounds(b)))) - a.width / 2);
  if (b.kind === "line") return elementDistance(b, a);
  return rectDistance(bounds(a), bounds(b));
}
