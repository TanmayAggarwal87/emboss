import { UploadError } from "@/lib/phase1/errors";
import { createUploadHandler } from "@/lib/phase1/upload-handler";
import { getUploadDependencies } from "@/lib/phase1/runtime";

export const runtime = "nodejs";

export const maxDuration = 600;

export async function POST(request: Request): Promise<Response> {
  try {
    const handler = createUploadHandler(getUploadDependencies());

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
