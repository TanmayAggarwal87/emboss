import { UploadError } from "@/lib/phase1/errors";
import { getUploadDependencies } from "@/lib/phase1/runtime";
import { createRetryHandler } from "@/lib/phase1/upload-handler";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }): Promise<Response> {
  try {
    const { jobId } = await context.params;
    return await createRetryHandler(getUploadDependencies())(request, jobId);
  } catch (error) {
    return Response.json({ error: {
      code: error instanceof UploadError ? error.code : "CONFIGURATION_ERROR",
      message: error instanceof UploadError ? error.message : "Emboss is not configured to retry documents yet.",
    } }, { status: error instanceof UploadError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
