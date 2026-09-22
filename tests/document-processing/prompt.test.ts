import assert from "node:assert/strict";
import test from "node:test";

import { getCallTypeAPrompt } from "../../src/lib/document-processing/prompt.ts";

test("loads Call Type A from docs and injects exact raster dimensions", async () => {
  const prompt = await getCallTypeAPrompt(1224, 1584);

  assert.match(prompt, /exactly\s+1224px wide and 1584px tall/);
  assert.match(prompt, /Do NOT transcribe/);
  assert.match(prompt, /"text" \| "diagram" \| "table"/);
  assert.doesNotMatch(prompt, /\{IMAGE_(WIDTH|HEIGHT)\}/);
});
