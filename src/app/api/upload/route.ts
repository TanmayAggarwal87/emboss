import { getPhase1Config } from "@/lib/phase1/config";
import { UploadError } from "@/lib/phase1/errors";
import { GeminiRegionClassifier } from "@/lib/phase1/gemini";
import { openPdf } from "@/lib/phase1/pdf";
import { UploadRateLimiter } from "@/lib/phase1/rate-limit";
import { SupabaseJobRepository } from "@/lib/phase1/repository";
import { createUploadHandler } from "@/lib/phase1/upload-handler";
import { getBrailleGrade } from "@/lib/phase2/config";
import { LocalTextRecognizer } from "@/lib/phase2/ocr";
import { TextRegionProcessor } from "@/lib/phase2/text-processor";

export const runtime = "nodejs";

const rateLimiter = new UploadRateLimiter();

export async function POST(request: Request): Promise<Response> {
  try {
    const phase1Config = getPhase1Config();
    const handler = createUploadHandler({
      config: phase1Config,
      rateLimiter,
      openPdf,
      classifier: new GeminiRegionClassifier(),
      repository: new SupabaseJobRepository(),
      textProcessor: new TextRegionProcessor(getBrailleGrade(), new LocalTextRecognizer()),
    });

    return handler(request);
  } catch (error) {
    if (error instanceof UploadError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }

    console.error("Could not initialize the Phase 1 upload route.", error);
    return Response.json(
      {
        error: {
          code: "CONFIGURATION_ERROR",
          message: "Emboss is not configured to process documents yet.",
        },
      },
      { status: 503 },
    );
  }
}
