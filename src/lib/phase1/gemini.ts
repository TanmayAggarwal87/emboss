import "server-only";

import { GoogleGenAI, Type, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";

import { getGeminiConfig } from "./config.ts";
import { classifyWithValidationRetries } from "./classification-schema.ts";
import { ClassificationServiceError } from "./errors.ts";
import { getCallTypeAPrompt } from "./prompt.ts";
import { providerStatus, withProviderRetries } from "./provider-retry.ts";
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
  constructor(private readonly options: {
    generate?: (request: GenerateContentParameters) => Promise<GenerateContentResponse>;
    sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  } = {}) {}

  async classify(
    page: RasterizedPage,
    maxValidationAttempts: number,
    signal?: AbortSignal,
  ): Promise<ClassifiedRegion[]> {
    const { apiKey, model } = getGeminiConfig();
    const client = this.options.generate ? undefined : new GoogleGenAI({ apiKey });
    const generate = this.options.generate ?? ((request) => client!.models.generateContent(request));
    const prompt = await getCallTypeAPrompt(page.width, page.height);
    const budget = { used: 0 };
    return classifyWithValidationRetries(
      async (attempt) => {
        let response;

        try {
          response = await withProviderRetries(() => generate({
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
              httpOptions: { timeout: 60_000, retryOptions: { attempts: 1 } },
              abortSignal: signal,
            },
          }), budget, { signal, sleep: this.options.sleep,
            onRetry: (httpStatus, delayMs) => console.info(JSON.stringify({
              event: "gemini_provider_retry", callType: "region_classification",
              pageNumber: page.pageNumber, httpStatus, delayMs, retry: budget.used,
            })),
          });
        } catch (error) {
          if (signal?.aborted) throw signal.reason;
          const status = providerStatus(error);
          console.warn(JSON.stringify({ event: "gemini_request_failed", callType: "region_classification",
            pageNumber: page.pageNumber, httpStatus: status ?? null }));
          throw new ClassificationServiceError(
            "The document analysis service could not classify this page.",
            undefined, status,
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
