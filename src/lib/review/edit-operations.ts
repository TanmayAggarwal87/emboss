import { translateBraille } from "../text-processing/braille.ts";
import { brailleSize } from "../tactile-geometry/measure.ts";
import type { GeometryState, LabelElement } from "../tactile-geometry/types.ts";
import { validateGeometry } from "../tactile-geometry/validate.ts";
import { z } from "zod";

export const editOperationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("relabel"), element_id: z.string(), detail: z.string() }).strict(),
  z.object({ operation: z.literal("unsupported"), element_id: z.null(), detail: z.null() }).strict(),
]);
export type EditOperation = z.infer<typeof editOperationSchema>;

const editableTitles = new Set(["label-x-title", "label-y-title", "legend-0"]);

export class EditValidationError extends Error {
  constructor(message: string) { super(message); this.name = "EditValidationError"; }
}

/** Applies only human-requested title text; all dimensions remain deterministic and validated. */
export function applyValidatedEdit(state: GeometryState, input: unknown, instruction: string): GeometryState {
  const parsed = editOperationSchema.safeParse(input);
  if (!parsed.success) throw new EditValidationError("The edit response did not match the allowed operation schema.");
  const operation = parsed.data;
  if (operation.operation === "unsupported") throw new EditValidationError("This edit is outside the supported title-relabeling scope.");
  if (!editableTitles.has(operation.element_id)) throw new EditValidationError("The selected element is not an editable title.");
  const match = /^new label text: ([^\r\n]+)$/.exec(operation.detail);
  const replacement = match?.[1]?.trim();
  if (!replacement) throw new EditValidationError("The edit must provide one non-empty, single-line title.");
  if (!instruction.includes(replacement)) throw new EditValidationError("Replacement text must appear verbatim in the reviewer's instruction.");

  const candidate = structuredClone(state);
  const target = candidate.elements.find((element): element is LabelElement =>
    element.kind === "label" && element.id === operation.element_id);
  if (!target) throw new EditValidationError("The selected title does not exist in the current geometry.");
  try {
    const translated = translateBraille(replacement, candidate.braille.grade);
    const size = brailleSize(translated.braille);
    target.text = replacement;
    target.braille = translated.braille;
    target.width = size.width;
    target.height = size.height;
  } catch {
    throw new EditValidationError("The replacement title could not be translated into braille.");
  }
  const issues = validateGeometry(candidate);
  if (issues.length) throw new EditValidationError("The edit failed BANA geometry validation; the current geometry was left unchanged.");
  return candidate;
}
