import { SupabaseJobRepository } from "@/lib/document-processing/repository";
import { createRegionApprovalHandler } from "@/lib/review/approval-handler";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ jobId: string; regionId: string }> }): Promise<Response> {
  const { jobId, regionId } = await context.params;
  return createRegionApprovalHandler((job, region) => new SupabaseJobRepository().approveRegion(job, region))(
    request, jobId, regionId,
  );
}
