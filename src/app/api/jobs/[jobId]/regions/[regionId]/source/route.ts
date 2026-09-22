import { getSourcePreviewStore, sourcePreviewResponse } from "@/lib/preview/source-preview";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string; regionId: string }> }) {
  const { jobId, regionId } = await context.params;
  return sourcePreviewResponse(getSourcePreviewStore(), jobId, regionId);
}
