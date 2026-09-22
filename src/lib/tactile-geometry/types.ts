import type { SupportedDiagramData } from "../diagram-extraction/schema.ts";
import type { PhysicalProfile } from "./profile.ts";

export type XY = [number, number];
export type Segment = { from: XY; to: XY };
export type BarElement = { id: string; kind: "bar"; sourceIndex: number; x: number; y: number;
  width: number; height: number; rise: number; texture: "stripes"; orientation: "vertical" | "horizontal" };
export type PointElement = { id: string; kind: "point"; sourceIndex: number; x: number; y: number;
  size: number; rise: number };
export type LineElement = { id: string; kind: "line"; role: "axis" | "data" | "grid";
  segments: Segment[]; width: number; rise: number };
export type LabelElement = { id: string; kind: "label"; x: number; y: number;
  text: string; braille: string; width: number; height: number; anchor: string | null };
export type GeometryElement = BarElement | PointElement | LineElement | LabelElement;
export type GeometryState = {
  version: 1; units: "mm"; source: SupportedDiagramData; profile: PhysicalProfile;
  braille: { grade: 1 | 2; table: string; version: string };
  plate: { width: number; height: number; thickness: number };
  // Origins/ranges are deterministic physical layout, never supplied by Gemini.
  mapping: { independent: [number, number]; dependent: [number, number];
    x: number; y: number; width: number; height: number; horizontal: boolean };
  elements: GeometryElement[];
};
export type ValidationIssue = { category: "accessibility" | "manufacturing" | "integrity";
  code: string; elementId?: string; message: string };
export type GeometryResult = { status: "validated"; geometry: GeometryState; warnings: string[] }
  | { status: "failed"; error: { code: string; message: string }; issues?: ValidationIssue[] };
export interface GeometryProcessor { process(data: SupportedDiagramData): GeometryResult }
