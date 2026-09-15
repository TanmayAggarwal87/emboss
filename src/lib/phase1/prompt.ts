import { readFile } from "node:fs/promises";
import path from "node:path";

const CALL_TYPE_A_HEADING = "## Call Type A — Region classification";
const SYSTEM_PROMPT_LABEL = "**System prompt:**";

let cachedTemplate: string | undefined;

export async function getCallTypeAPrompt(
  imageWidth: number,
  imageHeight: number,
): Promise<string> {
  const template = cachedTemplate ?? (await loadCallTypeATemplate());
  cachedTemplate = template;

  return template
    .replaceAll("{IMAGE_WIDTH}", String(imageWidth))
    .replaceAll("{IMAGE_HEIGHT}", String(imageHeight));
}

export function extractCallTypeATemplate(markdown: string): string {
  const sectionStart = markdown.indexOf(CALL_TYPE_A_HEADING);
  if (sectionStart === -1) {
    throw new Error("Call Type A heading is missing from docs/prompts.md.");
  }

  const promptLabel = markdown.indexOf(SYSTEM_PROMPT_LABEL, sectionStart);
  const fenceStart = markdown.indexOf("```", promptLabel);
  const contentStart = markdown.indexOf("\n", fenceStart) + 1;
  const fenceEnd = markdown.indexOf("\n```", contentStart);

  if (
    promptLabel === -1 ||
    fenceStart === -1 ||
    contentStart === 0 ||
    fenceEnd === -1
  ) {
    throw new Error("Call Type A system prompt is malformed in docs/prompts.md.");
  }

  return markdown.slice(contentStart, fenceEnd).trim();
}

async function loadCallTypeATemplate(): Promise<string> {
  const promptPath = path.join(process.cwd(), "docs", "prompts.md");
  return extractCallTypeATemplate(await readFile(promptPath, "utf8"));
}
