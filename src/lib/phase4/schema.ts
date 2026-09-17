import { z } from "zod";
import { DiagramValidationError } from "./errors.ts";

const label = z.string().refine((value) => value.trim().length > 0);
const point = z.object({ label, value: z.number().finite().nullable() }).strict();
const fields = {
  axis_labels: z.object({ x: z.string().nullable(), y: z.string().nullable() }).strict(),
  series_label: z.string().nullable(),
};

export const diagramSchema = z.discriminatedUnion("chart_type", [
  z.object({ chart_type: z.literal("bar_chart"), ...fields, data_points: z.array(point).min(1) }).strict(),
  z.object({ chart_type: z.literal("line_graph_single_series"), ...fields, data_points: z.array(point).min(2) }).strict(),
  z.object({ chart_type: z.literal("unsupported") }).strict(),
]);

export type DiagramData = z.infer<typeof diagramSchema>;
export type SupportedDiagramData = Exclude<DiagramData, { chart_type: "unsupported" }>;

export function parseDiagramResponse(text: string): DiagramData {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new DiagramValidationError("The diagram analysis returned malformed JSON.");
  }
  const result = diagramSchema.safeParse(value);
  if (!result.success) {
    throw new DiagramValidationError("The diagram analysis returned invalid chart data or unexpected fields.");
  }
  return result.data;
}

export async function extractWithValidationRetries(
  generate: (attempt: number) => Promise<string>,
  maxAttempts: number,
): Promise<DiagramData> {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new DiagramValidationError("The diagram validation attempt limit is invalid.");
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // Transport failures propagate immediately; only validation failures retry.
    const text = await generate(attempt);
    try {
      return parseDiagramResponse(text);
    } catch (error) {
      if (!(error instanceof DiagramValidationError)) throw error;
      if (attempt === maxAttempts) {
        throw new DiagramValidationError(`This diagram could not be read reliably after ${maxAttempts} validation attempts.`);
      }
    }
  }
  throw new DiagramValidationError("This diagram could not be read reliably.");
}
