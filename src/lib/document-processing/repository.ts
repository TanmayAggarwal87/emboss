import "server-only";
import { createHash } from "node:crypto";

import { getSupabaseAdmin } from "../supabase/admin.ts";
import { UploadError } from "./errors.ts";
import { validateGeometry } from "../tactile-geometry/validate.ts";
import { diagramSchema } from "../diagram-extraction/schema.ts";
import type {
  RegionToPersist,
  JobRepository,
  PersistedRegion,
} from "./types.ts";

export class SupabaseJobRepository implements JobRepository {
  async approveRegion(jobId: string, regionId: string): Promise<{ id: string; review_status: "approved" }> {
    const supabase = getSupabaseAdmin();
    const { data: region, error: readError } = await supabase.from("regions")
      .select("id, type, extracted_data, geometry")
      .eq("job_id", jobId).eq("id", regionId).maybeSingle();
    if (readError) throw new UploadError(503, "DATABASE_ERROR", "The region could not be loaded for approval.");
    if (!region) throw new UploadError(404, "REGION_NOT_FOUND", "This region could not be found in the document.");
    if (!isApprovableRegion(region.type, region.extracted_data, region.geometry)) {
      throw new UploadError(422, "REGION_NOT_READY", "This region has no successfully processed and validated output to approve.");
    }

    const { data, error } = await supabase.from("regions")
      .update({ review_status: "approved" })
      .eq("job_id", jobId).eq("id", regionId)
      .select("id, review_status").maybeSingle();
    if (error) throw new UploadError(503, "DATABASE_ERROR", "The approval could not be saved. Please try again.");
    if (!data) throw new UploadError(404, "REGION_NOT_FOUND", "This region could not be found in the document.");
    return { id: data.id, review_status: "approved" };
  }

  async createJob(pageCount: number): Promise<string> {
    const { data, error } = await getSupabaseAdmin()
      .from("jobs")
      .insert({ page_count: pageCount, status: "processing" })
      .select("id")
      .single();

    if (error) {
      throw new UploadError(
        503,
        "DATABASE_ERROR",
        "The document could not be started. Please try again.",
      );
    }

    return data.id;
  }

  async insertRegions(
    jobId: string,
    pageNumber: number,
    regions: RegionToPersist[],
  ): Promise<PersistedRegion[]> {
    if (regions.length === 0) {
      return [];
    }

    for (const region of regions) {
      const diagram = region.extracted_data?.kind === "diagram" && region.extracted_data.status === "processed" ? region.extracted_data : undefined;
      const source = diagram && diagramSchema.safeParse(diagram.data);
      if ((diagram?.geometry_processing?.status === "validated" && !region.geometry) || (region.geometry &&
        (region.type !== "diagram" || !source || !source.success || validateGeometry(region.geometry).length ||
          JSON.stringify(source.data) !== JSON.stringify(diagramSchema.parse(region.geometry.source))))) {
        throw new UploadError(422, "GEOMETRY_INVALID", "Invalid geometry was blocked before persistence. Extracted results can still be reviewed.");
      }
    }

    const records = regions.map((region) => ({
      id: regionRowId(jobId, pageNumber, region.region_id),
      job_id: jobId, page_number: pageNumber, type: region.type,
      bounding_box: region.bounding_box, review_status: "pending" as const,
      extracted_data: region.extracted_data ?? null,
      geometry: region.geometry ?? null,
    }));
    const { error } = await getSupabaseAdmin()
      .from("regions")
      .upsert(records, { onConflict: "id", ignoreDuplicates: true });

    if (error) {
      throw new UploadError(
        503,
        "DATABASE_ERROR",
        `Page ${pageNumber} was classified, but its regions could not be saved.`,
      );
    }

    // A lost commit acknowledgement must not duplicate a page or overwrite a
    // previously saved review result. Read back both new and existing IDs.
    const { data, error: readError } = await getSupabaseAdmin().from("regions")
      .select("id, type, bounding_box, review_status, extracted_data, geometry")
      .eq("job_id", jobId).in("id", records.map((record) => record.id));
    if (readError || data?.length !== records.length) {
      throw new UploadError(503, "DATABASE_ERROR", `Page ${pageNumber} could not be confirmed as saved. Retry this page to resume without repeating its analysis.`);
    }
    const byId = new Map(data.map((row) => [row.id, row]));
    return records.map((record) => byId.get(record.id)) as PersistedRegion[];
  }

  async markJobFailed(jobId: string, message: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from("jobs")
      .update({ status: "failed", error_message: message })
      .eq("id", jobId);

    if (error) {
      throw new UploadError(503, "DATABASE_ERROR", "The job status could not be saved. Its completed regions have been preserved.");
    }
  }

  async markJobProcessing(jobId: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from("jobs")
      .update({ status: "processing", error_message: null }).eq("id", jobId);
    if (error) throw new UploadError(503, "DATABASE_ERROR", "The recovered job status could not be saved. Its completed regions have been preserved.");
  }

  async markJobReady(jobId: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from("jobs")
      .update({ status: "ready_for_review", error_message: null }).eq("id", jobId);
    if (error) throw new UploadError(503, "DATABASE_ERROR", "The validated results were saved, but review readiness could not be recorded.");
  }
}

function isApprovableRegion(type: string, extracted: unknown, geometry: unknown): boolean {
  if (!extracted || typeof extracted !== "object" || Array.isArray(extracted)) return false;
  const result = extracted as { kind?: unknown; status?: unknown; geometry_processing?: { status?: unknown }; data?: unknown };
  if (result.kind !== type || result.status !== "processed") return false;
  if (type !== "diagram") return type === "text" || type === "table";
  if (result.geometry_processing?.status !== "validated" || !geometry || typeof geometry !== "object") return false;
  const source = diagramSchema.safeParse(result.data);
  const geometrySource = diagramSchema.safeParse((geometry as { source?: unknown }).source);
  return !!source.success && !!geometrySource.success && validateGeometry(geometry).length === 0 &&
    JSON.stringify(source.data) === JSON.stringify(geometrySource.data);
}

export function regionRowId(jobId: string, pageNumber: number, regionId: string): string {
  const hash = createHash("sha256").update(JSON.stringify([jobId, pageNumber, regionId])).digest("hex");
  // UUIDv8 for a deterministic DB row key, not an element/geometry ID scheme.
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-${((parseInt(hash[16], 16) & 3) | 8).toString(16)}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
