import "server-only";
import { getPhase1Config } from "./config.ts";
import { GeminiRegionClassifier } from "./gemini.ts";
import { openPdf } from "./pdf.ts";
import { UploadRateLimiter } from "./rate-limit.ts";
import { SupabaseJobRepository } from "./repository.ts";
import { RetrySessionStore } from "./retry-sessions.ts";
import type { UploadDependencies } from "./upload-handler.ts";
import { getBrailleGrade } from "../phase2/config.ts";
import { LocalTextRecognizer } from "../phase2/ocr.ts";
import { TextRegionProcessor } from "../phase2/text-processor.ts";
import { TableRegionProcessor } from "../phase3/table-processor.ts";
import { DiagramRegionProcessor } from "../phase4/diagram-processor.ts";
import { GeminiDiagramExtractor } from "../phase4/gemini.ts";
import { DeterministicGeometryProcessor } from "../phase5/generate.ts";
import { getPhysicalProfile } from "../phase5/profile.ts";

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
  };
}
