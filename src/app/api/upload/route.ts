import { UploadError } from "@/lib/document-processing/errors";
import { createUploadHandler } from "@/lib/document-processing/upload-handler";
import { getUploadDependencies, getUploadRateLimit } from "@/lib/document-processing/runtime";
import { getClientIp } from "@/lib/document-processing/rate-limit";

export const runtime = "nodejs";

export const maxDuration = 600;

export function GET(request: Request): Response {
  try {
    const { rateLimiter, limit } = getUploadRateLimit();
    return Response.json(
      { remaining: rateLimiter.remaining(getClientIp(request), limit), limit },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: { code: "CONFIGURATION_ERROR", message: "Upload availability is temporarily unavailable." } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

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
