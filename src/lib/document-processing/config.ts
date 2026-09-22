import "server-only";

import { z } from "zod";

import { UploadError } from "./errors.ts";
import type { Phase1Config } from "./types.ts";

const positiveInteger = z.coerce.number().int().positive();

const phase1EnvironmentSchema = z.object({
  MAX_PDF_PAGES: positiveInteger.default(3),
  MAX_UPLOAD_SIZE_MB: positiveInteger.default(7),
  RATE_LIMIT_UPLOADS_PER_IP: positiveInteger.default(5),
  MAX_GEMINI_VALIDATION_RETRIES: positiveInteger.default(3),
});

const geminiEnvironmentSchema = z.object({
  GEMINI_API_KEY: z.string().trim().min(1),
  GEMINI_MODEL: z.string().trim().min(1),
});

export function getPhase1Config(): Phase1Config {
  const result = phase1EnvironmentSchema.safeParse(process.env);

  if (!result.success) {
    throw new UploadError(
      503,
      "CONFIGURATION_ERROR",
      "Emboss is not configured to process documents yet.",
    );
  }

  return {
    maxPdfPages: result.data.MAX_PDF_PAGES,
    maxUploadBytes: result.data.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    uploadsPerIp: result.data.RATE_LIMIT_UPLOADS_PER_IP,
    maxGeminiValidationAttempts:
      result.data.MAX_GEMINI_VALIDATION_RETRIES,
  };
}

export function getGeminiConfig(): { apiKey: string; model: string } {
  const result = geminiEnvironmentSchema.safeParse(process.env);

  if (!result.success) {
    throw new UploadError(
      503,
      "GEMINI_NOT_CONFIGURED",
      "Document analysis is not configured yet. Please try again later.",
    );
  }

  return {
    apiKey: result.data.GEMINI_API_KEY,
    model: result.data.GEMINI_MODEL,
  };
}
