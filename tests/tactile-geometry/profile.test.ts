import assert from "node:assert/strict";
import test from "node:test";
import { ACCESSIBILITY, BRAILLE, DEFAULT_PROFILE, getPhysicalProfile, profileSchema } from "../../src/lib/tactile-geometry/profile.ts";

test("blank environment defaults to the approved portable FDM profile without changing braille", () => {
  const profile = getPhysicalProfile({ MAX_PLATE_WIDTH_MM: "", MAX_PLATE_HEIGHT_MM: "  " });
  assert.deepEqual([profile.maxWidth, profile.maxHeight, profile.baseThickness], [180, 180, 2]);
  assert.deepEqual(BRAILLE, { dotHeight: 0.48, dotDiameter: 1.44, dotPitch: 2.34, cellPitch: 6.2, linePitch: 10 });
  assert.equal(ACCESSIBILITY.genericPointMin, 6);
  assert.equal(ACCESSIBILITY.plottedPointMin, 3);
  const custom = getPhysicalProfile({ MAX_PLATE_WIDTH_MM: "150", MAX_PLATE_HEIGHT_MM: "160", TACTILE_PLATE_THICKNESS_MM: "3" });
  assert.deepEqual([custom.maxWidth, custom.maxHeight, custom.baseThickness], [150, 160, 3]);
});

test("invalid profiles cannot disable printable minima or invert tactile hierarchy", () => {
  for (const change of [{ gridWidth: 0.1 }, { axisRise: 2 }, { stripePitch: 1 }, { gridGap: 1 },
    { minFeatureWidth: 0.01 }, { minFeatureRise: 0.01 }, { baseThickness: 0.1 }, { maxHeight: 181 }]) {
    assert.equal(profileSchema.safeParse({ ...DEFAULT_PROFILE, ...change }).success, false);
  }
  for (const value of ["NaN", "Infinity", "0", "-1", "181"]) assert.throws(() => getPhysicalProfile({ MAX_PLATE_WIDTH_MM: value }));
});
