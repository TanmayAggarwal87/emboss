import { z } from "zod";
import { UploadError } from "../document-processing/errors.ts";

export const editRequestSchema = z.object({ instruction: z.string().trim().min(1).max(1000) }).strict();
type EditRegion = (jobId: string, regionId: string, instruction: string) => Promise<unknown>;

export function createRegionEditHandler(editRegion: EditRegion) {
  return async (request: Request, jobId: string, regionId: string): Promise<Response> => {
    if (!z.uuid().safeParse(jobId).success || !z.uuid().safeParse(regionId).success) {
      return Response.json({ error: { code: "INVALID_ID", message: "The job or region link is invalid." } },
        { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    let raw: unknown;
    try { raw = await request.json(); } catch { raw = undefined; }
    const body = editRequestSchema.safeParse(raw);
    if (!body.success) return Response.json({ error: { code: "INVALID_EDIT_REQUEST", message: "Enter one edit instruction of up to 1,000 characters." } },
      { status: 400, headers: { "Cache-Control": "no-store" } });
    try {
      return Response.json(await editRegion(jobId, regionId, body.data.instruction), { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const known = error instanceof UploadError;
      return Response.json({ error: { code: known ? error.code : "EDIT_FAILED", message: known ? error.message : "This edit could not be applied. The saved geometry remains available." } },
        { status: known ? error.status : 503, headers: { "Cache-Control": "no-store" } });
    }
  };
}
