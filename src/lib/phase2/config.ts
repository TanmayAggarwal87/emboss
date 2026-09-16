import { UploadError } from "../phase1/errors.ts";
import type { BrailleGrade } from "./types.ts";

export function getBrailleGrade(env: Record<string, string | undefined> = process.env): BrailleGrade {
  const value = env.BRAILLE_GRADE ?? "2";
  if (value !== "1" && value !== "2") {
    throw new UploadError(503, "CONFIGURATION_ERROR", "BRAILLE_GRADE must be 1 or 2.");
  }
  return value === "1" ? 1 : 2;
}
