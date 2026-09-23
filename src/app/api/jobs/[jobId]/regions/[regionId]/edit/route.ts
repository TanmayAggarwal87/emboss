import { NextResponse } from "next/server";
import { SupabaseJobRepository } from "@/lib/document-processing/repository";
import { createRegionEditHandler } from "@/lib/review/edit-handler";
import { GeminiEditAgent } from "@/lib/review/gemini-edit-agent";
import { createRegionEditService } from "@/lib/review/edit-service";

export const runtime = "nodejs";
const handleEdit = createRegionEditHandler(createRegionEditService(new SupabaseJobRepository(), new GeminiEditAgent()));

export async function POST(request: Request, context: { params: Promise<{ jobId: string; regionId: string }> }) {
  const { jobId, regionId } = await context.params;
  try { return await handleEdit(request, jobId, regionId); }
  catch { return NextResponse.json({ error: { code: "EDIT_FAILED", message: "This edit could not be applied. The saved geometry remains available." } }, { status: 503 }); }
}
