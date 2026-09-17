import "server-only";

import { GoogleGenAI, Type, type GenerateContentParameters, type GenerateContentResponse, type Schema } from "@google/genai";
import { getGeminiConfig } from "../phase1/config.ts";
import { DiagramProcessingError } from "./errors.ts";
import { getCallTypeBPrompt } from "./prompt.ts";
import { extractWithValidationRetries } from "./schema.ts";
import type { DiagramExtractor } from "./types.ts";

const nullableString: Schema = { type: Type.STRING, nullable: true };
const supportedSchema = (chartType: string, minItems: string): Schema => ({
  type: Type.OBJECT,
  properties: {
    chart_type: { type: Type.STRING, enum: [chartType] },
    axis_labels: { type: Type.OBJECT, properties: { x: nullableString, y: nullableString }, required: ["x", "y"] },
    data_points: { type: Type.ARRAY, minItems, items: {
      type: Type.OBJECT,
      properties: { label: { type: Type.STRING }, value: { type: Type.NUMBER, nullable: true } },
      required: ["label", "value"],
    } },
    series_label: nullableString,
  },
  required: ["chart_type", "axis_labels", "data_points", "series_label"],
});

const responseSchema: Schema = {
  anyOf: [
    supportedSchema("bar_chart", "1"),
    supportedSchema("line_graph_single_series", "2"),
    { type: Type.OBJECT, properties: { chart_type: { type: Type.STRING, enum: ["unsupported"] } }, required: ["chart_type"] },
  ],
};

type Generate = (request: GenerateContentParameters) => Promise<GenerateContentResponse>;

export class GeminiDiagramExtractor implements DiagramExtractor {
  // Injecting the transport allows quota-free tests of the actual API configuration.
  constructor(private readonly generate?: Generate) {}

  async extract(png: Uint8Array, maxAttempts: number) {
    const { apiKey, model } = getGeminiConfig();
    const client = this.generate ? undefined : new GoogleGenAI({ apiKey });
    const generate = this.generate ?? ((request) => client!.models.generateContent(request));
    const prompt = await getCallTypeBPrompt();
    const request: GenerateContentParameters = {
      model,
      contents: [{ inlineData: { mimeType: "image/png", data: Buffer.from(png).toString("base64") } }],
      config: {
        systemInstruction: prompt,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0,
        thinkingConfig: { thinkingBudget: 0 },
        httpOptions: { timeout: 60_000, retryOptions: { attempts: 1 } },
      },
    };
    return extractWithValidationRetries(async (attempt) => {
      let response: GenerateContentResponse;
      try {
        response = await generate(request);
      } catch (error) {
        const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
        console.warn(JSON.stringify({ event: "gemini_request_failed", callType: "diagram_extraction",
          httpStatus: typeof status === "number" ? status : null }));
        throw new DiagramProcessingError(
          status === 429 ? "DIAGRAM_RATE_LIMITED" : "DIAGRAM_SERVICE_UNAVAILABLE",
          status === 429
            ? "Diagram analysis has reached its request limit. Please wait a few minutes before trying again."
            : "The diagram analysis service is unavailable or timed out. Please wait a few minutes before trying again.",
        );
      }
      console.info(JSON.stringify({ event: "gemini_token_usage", callType: "diagram_extraction", attempt,
        promptTokens: response.usageMetadata?.promptTokenCount ?? null,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
        totalTokens: response.usageMetadata?.totalTokenCount ?? null }));
      const finishReason = response.candidates?.[0]?.finishReason;
      if (response.promptFeedback?.blockReason || (finishReason && finishReason !== "STOP")) {
        throw new DiagramProcessingError("DIAGRAM_RESPONSE_INCOMPLETE", "The analysis service could not return a complete diagram result. Other regions can still continue.");
      }
      return response.text ?? "";
    }, maxAttempts);
  }
}
