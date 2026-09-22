import "server-only";
import { getPhase1Config } from "./config.ts";
import { GeminiRegionClassifier } from "./gemini.ts";
import { openPdf } from "./pdf.ts";
import { UploadRateLimiter } from "./rate-limit.ts";
import { SupabaseJobRepository } from "./repository.ts";
import { RetrySessionStore } from "./retry-sessions.ts";
import type { UploadDependencies } from "./upload-handler.ts";
import { getBrailleGrade } from "../text-processing/config.ts";
import { LocalTextRecognizer } from "../text-processing/ocr.ts";
import { TextRegionProcessor } from "../text-processing/text-processor.ts";
import { TableRegionProcessor } from "../table-processing/table-processor.ts";
import { DiagramRegionProcessor } from "../diagram-extraction/diagram-processor.ts";
import { GeminiDiagramExtractor } from "../diagram-extraction/gemini.ts";
import { DeterministicGeometryProcessor } from "../tactile-geometry/generate.ts";
import { getPhysicalProfile } from "../tactile-geometry/profile.ts";
import { getSourcePreviewStore } from "../preview/source-preview.ts";

// Route bundles and development reloads share one process-local session/guard.
// A different process must return 410 rather than pretending it has the PDF.
const shared = globalThis as typeof globalThis & {
  embossUploadRuntime?: { sessions: RetrySessionStore; rateLimiter: UploadRateLimiter };
};

export function getUploadDependencies(): UploadDependencies & { sessions: RetrySessionStore } {
  const runtime = shared.embossUploadRuntime ??= {
    sessions: new RetrySessionStore(), rateLimiter: new UploadRateLimiter(),
  };
  const grade = getBrailleGrade();
  return {
    ...runtime, config: getPhase1Config(), openPdf,
    classifier: new GeminiRegionClassifier(), repository: new SupabaseJobRepository(),
    textProcessor: new TextRegionProcessor(grade, new LocalTextRecognizer()),
    tableProcessor: new TableRegionProcessor(grade),
    diagramProcessor: new DiagramRegionProcessor(new GeminiDiagramExtractor()),
    geometryProcessor: new DeterministicGeometryProcessor(getPhysicalProfile(process.env), grade),
    sourcePreviews: getSourcePreviewStore(),
  };
}
