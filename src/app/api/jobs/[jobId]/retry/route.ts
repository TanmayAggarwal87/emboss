import { UploadError } from "@/lib/document-processing/errors";
import { getUploadDependencies } from "@/lib/document-processing/runtime";
import { createRetryHandler } from "@/lib/document-processing/upload-handler";

export const runtime = "nodejs";
export const maxDuration = 300;

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
