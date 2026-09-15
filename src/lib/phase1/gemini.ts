import "server-only";

import { GoogleGenAI, Type } from "@google/genai";

import { getGeminiConfig } from "./config.ts";
import { classifyWithValidationRetries } from "./classification-schema.ts";
import { ClassificationServiceError } from "./errors.ts";
import { getCallTypeAPrompt } from "./prompt.ts";
import type {
  ClassifiedRegion,
  RasterizedPage,
  RegionClassifier,
} from "./types.ts";

const classificationResponseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      region_id: { type: Type.STRING },
      type: {
        type: Type.STRING,
        format: "enum",
        enum: ["text", "diagram", "table"],
      },
      bounding_box: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER, minimum: 0 },
          y: { type: Type.NUMBER, minimum: 0 },
          width: { type: Type.NUMBER, minimum: 0 },
          height: { type: Type.NUMBER, minimum: 0 },
        },
        required: ["x", "y", "width", "height"],
      },
    },
    required: ["region_id", "type", "bounding_box"],
  },
} as const;

export class GeminiRegionClassifier implements RegionClassifier {
  async classify(
    page: RasterizedPage,
    maxValidationAttempts: number,
  ): Promise<ClassifiedRegion[]> {
    const { apiKey, model } = getGeminiConfig();
    const client = new GoogleGenAI({ apiKey });
    const prompt = await getCallTypeAPrompt(page.width, page.height);
    return classifyWithValidationRetries(
      async (attempt) => {
        let response;

        try {
          response = await client.models.generateContent({
            model,
            contents: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: page.pngBase64,
                },
              },
            ],
            config: {
              systemInstruction: prompt,
              responseMimeType: "application/json",
              responseSchema: classificationResponseSchema,
              temperature: 0,
              thinkingConfig: { thinkingBudget: 0 },
            },
          });
        } catch (error) {
          throw new ClassificationServiceError(
            "The document analysis service could not classify this page.",
            { cause: error },
          );
        }

        return {
          text: response.text ?? "",
          onAttempt: () =>
            logTokenUsage(page.pageNumber, attempt, response.usageMetadata),
        };
      },
      page.width,
      page.height,
      maxValidationAttempts,
    );
  }
}

function logTokenUsage(
  pageNumber: number,
  attempt: number,
  usage:
    | {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      }
    | undefined,
): void {
  console.info(
    JSON.stringify({
      event: "gemini_token_usage",
      callType: "region_classification",
      pageNumber,
      attempt,
      promptTokens: usage?.promptTokenCount ?? null,
      outputTokens: usage?.candidatesTokenCount ?? null,
      totalTokens: usage?.totalTokenCount ?? null,
    }),
  );
}
