import { z } from "zod";

// BANA/NLS-derived constraints: docs/bana-standards.md §§1,2,4,5,6,10.
export const ACCESSIBILITY = Object.freeze({
  margin: 6.35, separation: 3, labelClearance: 3.18, labelClearanceMax: 6.35,
  barMinWidth: 9.53, barMaxWidth: 25.4, areaMin: 161.29, dataPathMin: 25.4,
  genericPointMin: 6, plottedPointMin: 3, maxTextures: 5,
});
export const BRAILLE = Object.freeze({ dotHeight: 0.48, dotDiameter: 1.44,
  dotPitch: 2.34, cellPitch: 6.2, linePitch: 10 });

// Manufacturing choices, NOT BANA requirements: docs/bana-standards.md §11.
export const DEFAULT_PROFILE = Object.freeze({
  maxWidth: 180, maxHeight: 180, baseThickness: 2,
  gridWidth: 0.8, axisWidth: 1.2, dataWidth: 1.6,
  gridRise: 0.25, axisRise: 0.55, dataRise: 0.9,
  minFeatureWidth: 0.8, minFeatureRise: 0.2,
  barRise: 0.8, pointRise: 1, stripeRise: 0.2, stripeWidth: 0.8,
  stripePitch: 4, stripeInset: 1.6, gridDash: 3, gridGap: 3, embedDepth: 0.05,
});
export type PhysicalProfile = { [K in keyof typeof DEFAULT_PROFILE]: number };
const positive = z.number().finite().positive();
export const profileSchema = z.object({
  maxWidth: positive.max(DEFAULT_PROFILE.maxWidth), maxHeight: positive.max(DEFAULT_PROFILE.maxHeight), baseThickness: positive,
  gridWidth: positive, axisWidth: positive, dataWidth: positive,
  gridRise: positive, axisRise: positive, dataRise: positive,
  minFeatureWidth: positive.min(DEFAULT_PROFILE.minFeatureWidth),
  minFeatureRise: positive.min(DEFAULT_PROFILE.minFeatureRise),
  barRise: positive, pointRise: positive, stripeRise: positive, stripeWidth: positive,
  stripePitch: positive, stripeInset: positive, gridDash: positive, gridGap: positive, embedDepth: positive,
}).strict().superRefine((p, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (!(p.dataWidth > p.axisWidth && p.axisWidth > p.gridWidth &&
    p.dataRise > p.axisRise && p.axisRise > p.gridRise)) fail("Data > axis > grid prominence is required.");
  if ([p.gridWidth, p.axisWidth, p.dataWidth, p.stripeWidth, p.gridDash].some((n) => n < p.minFeatureWidth)) fail("A feature is narrower than the manufacturing minimum.");
  if ([p.gridRise, p.axisRise, p.dataRise, p.barRise, p.pointRise, p.stripeRise].some((n) => n < p.minFeatureRise)) fail("A relief is below the manufacturing minimum.");
  if (p.stripePitch - p.stripeWidth < ACCESSIBILITY.separation || p.gridGap < ACCESSIBILITY.separation) fail("Texture/grid gaps are too small.");
  if (p.stripeInset < p.stripeWidth || p.baseThickness < p.minFeatureWidth || p.embedDepth >= p.baseThickness ||
    p.pointRise < p.dataRise || BRAILLE.dotDiameter < p.minFeatureWidth || BRAILLE.dotHeight < p.minFeatureRise) fail("The profile cannot reproduce the required features.");
});

export function getPhysicalProfile(environment: Record<string, string | undefined> = {}): PhysicalProfile {
  const number = (key: string, fallback: number) => environment[key]?.trim() ? Number(environment[key]) : fallback;
  return profileSchema.parse({ ...DEFAULT_PROFILE,
    maxWidth: number("MAX_PLATE_WIDTH_MM", DEFAULT_PROFILE.maxWidth),
    maxHeight: number("MAX_PLATE_HEIGHT_MM", DEFAULT_PROFILE.maxHeight),
    baseThickness: number("TACTILE_PLATE_THICKNESS_MM", DEFAULT_PROFILE.baseThickness),
  });
}
