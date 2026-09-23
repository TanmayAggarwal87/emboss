import "server-only";

import { GoogleGenAI, Type, type GenerateContentParameters, type GenerateContentResponse, type Schema } from "@google/genai";
import { getGeminiConfig, getPhase1Config } from "../document-processing/config.ts";
import { UploadError } from "../document-processing/errors.ts";
import type { GeometryState, LabelElement } from "../tactile-geometry/types.ts";
import { editOperationSchema, type EditOperation } from "./edit-operations.ts";
import { getCallTypeCPrompt } from "./prompt.ts";

const responseSchema: Schema = { anyOf: [
  { type: Type.OBJECT, properties: { operation: { type: Type.STRING, enum: ["relabel"] }, element_id: { type: Type.STRING }, detail: { type: Type.STRING } }, required: ["operation", "element_id", "detail"] },
  { type: Type.OBJECT, properties: { operation: { type: Type.STRING, enum: ["unsupported"] }, element_id: { type: Type.STRING, nullable: true }, detail: { type: Type.STRING, nullable: true } }, required: ["operation", "element_id", "detail"] },
] };

type Generate = (request: GenerateContentParameters) => Promise<GenerateContentResponse>;
export type EditAgent = { propose(state: GeometryState, instruction: string): Promise<EditOperation> };

export class GeminiEditAgent implements EditAgent {
  constructor(private readonly generate?: Generate) {}

  async propose(state: GeometryState, instruction: string): Promise<EditOperation> {
    const { apiKey, model } = getGeminiConfig();
    const client = this.generate ? undefined : new GoogleGenAI({ apiKey });
    const generate = this.generate ?? ((request) => client!.models.generateContent(request));
    const eligible = state.elements.filter((element): element is LabelElement => element.kind === "label" &&
      ["label-x-title", "label-y-title", "legend-0"].includes(element.id))
      .map(({ id, text }) => ({ element_id: id, current_text: text }));
    const request: GenerateContentParameters = {
      model,
      contents: JSON.stringify({ instruction, editable_titles: eligible }),
      config: { systemInstruction: await getCallTypeCPrompt(), responseMimeType: "application/json", responseSchema,
        temperature: 0, thinkingConfig: { thinkingBudget: 0 }, httpOptions: { timeout: 60_000, retryOptions: { attempts: 1 } } },
    };
    const maxAttempts = getPhase1Config().maxGeminiValidationAttempts;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response: GenerateContentResponse;
      try { response = await generate(request); }
      catch (error) {
        const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
        throw new UploadError(status === 429 ? 429 : 503, status === 429 ? "EDIT_RATE_LIMITED" : "EDIT_SERVICE_UNAVAILABLE",
          status === 429 ? "The edit service is rate limited. Please wait before trying again." : "The edit service is unavailable. Please try again later.");
      }
      console.info(JSON.stringify({ event: "gemini_token_usage", callType: "edit_interpreter", attempt,
        promptTokens: response.usageMetadata?.promptTokenCount ?? null,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
        totalTokens: response.usageMetadata?.totalTokenCount ?? null }));
      const finish = response.candidates?.[0]?.finishReason;
      if (response.promptFeedback?.blockReason || (finish && finish !== "STOP")) {
        throw new UploadError(422, "EDIT_RESPONSE_INCOMPLETE", "The edit request could not be safely interpreted.");
      }
      let raw: unknown;
      try { raw = JSON.parse(response.text ?? ""); } catch { raw = undefined; }
      const result = editOperationSchema.safeParse(raw);
      if (result.success) return result.data;
      if (attempt === maxAttempts) break;
    }
    throw new UploadError(422, "EDIT_VALIDATION_EXHAUSTED", `The edit response could not be validated after ${maxAttempts} attempts.`);
  }
}
