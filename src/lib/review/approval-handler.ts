import { z } from "zod";
import { UploadError } from "../document-processing/errors.ts";

export type ApprovedRegion = { id: string; review_status: "approved" };
type ApproveRegion = (jobId: string, regionId: string) => Promise<ApprovedRegion>;

export function createRegionApprovalHandler(approveRegion: ApproveRegion) {
  return async (_request: Request, jobId: string, regionId: string): Promise<Response> => {
    if (!z.uuid().safeParse(jobId).success || !z.uuid().safeParse(regionId).success) {
      return Response.json({ error: { code: "INVALID_ID", message: "The job or region link is invalid." } },
        { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    try {
      const region = await approveRegion(jobId, regionId);
      return Response.json({ region }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const known = error instanceof UploadError;
      return Response.json({ error: {
        code: known ? error.code : "APPROVAL_FAILED",
        message: known ? error.message : "This region could not be approved right now. Please try again.",
      } }, { status: known ? error.status : 503, headers: { "Cache-Control": "no-store" } });
    }
  };
}
