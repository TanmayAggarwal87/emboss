import { z } from "zod";
import { DiagramValidationError } from "./errors.ts";

const label = z.string().refine((value) => value.trim().length > 0);
const point = z.object({ label, value: z.number().finite().nullable() }).strict();
const independentAxis = z.discriminatedUnion("type", [
  z.object({ type: z.literal("categorical"), values: z.array(label).min(1) }).strict(),
  z.object({ type: z.literal("numeric"), values: z.array(z.number().finite().nullable()).min(1) }).strict(),
]);
const fields = {
  axis_labels: z.object({ x: z.string().nullable(), y: z.string().nullable() }).strict(),
  series_label: z.string().nullable(),
  independent_axis: independentAxis,
};

const diagramSchemaBase = z.discriminatedUnion("chart_type", [
  z.object({ chart_type: z.literal("bar_chart"), ...fields, orientation: z.enum(["vertical", "horizontal"]), data_points: z.array(point).min(1) }).strict(),
  z.object({ chart_type: z.literal("line_graph_single_series"), ...fields, data_points: z.array(point).min(2) }).strict(),
  z.object({ chart_type: z.literal("unsupported") }).strict(),
]);

export const diagramSchema = diagramSchemaBase.superRefine((data, ctx) => {
  if (data.chart_type === "unsupported") return;
  if (data.independent_axis.values.length !== data.data_points.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["independent_axis", "values"], message: "Independent-axis values must align one-to-one with data points." });
  }
});

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
