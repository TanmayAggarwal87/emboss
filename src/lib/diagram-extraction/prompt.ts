import { readFile } from "node:fs/promises";
import path from "node:path";

let cachedPrompt: string | undefined;

export function extractCallTypeBPrompt(markdown: string): string {
  const heading = "## Call Type B — Diagram structured-data extraction";
  const start = markdown.indexOf(heading);
  if (start < 0) throw new Error("Call Type B is missing from docs/prompts.md.");
  const next = markdown.indexOf("\n## ", start + heading.length);
  const section = markdown.slice(start, next < 0 ? undefined : next);
  const match = section.match(/\*\*System prompt:\*\*\s*```\r?\n([\s\S]*?)\r?\n```/);
  if (!match) throw new Error("Call Type B system prompt is malformed in docs/prompts.md.");
  return match[1].trim();
}

export async function getCallTypeBPrompt(): Promise<string> {
  cachedPrompt ??= extractCallTypeBPrompt(await readFile(path.join(process.cwd(), "docs", "prompts.md"), "utf8"));
  return cachedPrompt;
}
