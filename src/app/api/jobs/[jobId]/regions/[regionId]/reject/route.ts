import { SupabaseJobRepository } from "@/lib/document-processing/repository";
import { createRegionRejectionHandler } from "@/lib/review/approval-handler";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ jobId: string; regionId: string }> }): Promise<Response> {
  const { jobId, regionId } = await context.params;
  return createRegionRejectionHandler((job, region) => new SupabaseJobRepository().rejectRegion(job, region))(
    request, jobId, regionId,
  );
}
