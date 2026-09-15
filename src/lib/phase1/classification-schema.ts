import { z } from "zod";

import { ClassificationValidationError } from "./errors.ts";
import type { ClassifiedRegion } from "./types.ts";

type ClassificationResponse = {
  text: string;
  onAttempt?(attempt: number): void;
};

export async function classifyWithValidationRetries(
  generate: (attempt: number) => Promise<ClassificationResponse>,
  imageWidth: number,
  imageHeight: number,
  maxAttempts: number,
): Promise<ClassifiedRegion[]> {
  let lastError: ClassificationValidationError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await generate(attempt);
    response.onAttempt?.(attempt);

    try {
      return parseClassificationResponse(
        response.text,
        imageWidth,
        imageHeight,
      );
    } catch (error) {
      if (!(error instanceof ClassificationValidationError)) {
        throw error;
      }
      lastError = error;
    }
  }

  throw new ClassificationValidationError(
    `This page could not be classified reliably after ${maxAttempts} attempts.`,
    { cause: lastError },
  );
}

export function parseClassificationResponse(
  responseText: string,
  imageWidth: number,
  imageHeight: number,
): ClassifiedRegion[] {
  let value: unknown;

  try {
    value = JSON.parse(responseText);
  } catch {
    throw new ClassificationValidationError(
      "Gemini returned malformed classification JSON.",
    );
  }

  const coordinate = z.number().finite().nonnegative();
  const dimension = z.number().finite().positive();
  const regionSchema = z
    .object({
      region_id: z.string().trim().min(1),
      type: z.enum(["text", "diagram", "table"]),
      bounding_box: z
        .object({
          x: coordinate,
          y: coordinate,
          width: dimension,
          height: dimension,
        })
        .strict(),
    })
    .strict();

  const responseSchema = z.array(regionSchema).superRefine((regions, context) => {
    const ids = new Set<string>();

    regions.forEach((region, index) => {
      if (ids.has(region.region_id)) {
        context.addIssue({
          code: "custom",
          path: [index, "region_id"],
          message: "Region IDs must be unique within a page.",
        });
      }
      ids.add(region.region_id);

      const box = region.bounding_box;
      if (box.x + box.width > imageWidth || box.y + box.height > imageHeight) {
        context.addIssue({
          code: "custom",
          path: [index, "bounding_box"],
          message: "Bounding box must remain inside the page raster.",
        });
      }
    });
  });

  const result = responseSchema.safeParse(value);
  if (!result.success) {
    throw new ClassificationValidationError(
      "Gemini returned an invalid or out-of-bounds classification.",
    );
  }

  return result.data;
}
