import "server-only";
import { createHash } from "node:crypto";

import { getSupabaseAdmin } from "../supabase/admin.ts";
import { UploadError } from "./errors.ts";
import { validateGeometry } from "../phase5/validate.ts";
import { diagramSchema } from "../phase4/schema.ts";
import type {
  RegionToPersist,
  JobRepository,
  PersistedRegion,
} from "./types.ts";

export class SupabaseJobRepository implements JobRepository {
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

export function regionRowId(jobId: string, pageNumber: number, regionId: string): string {
  const hash = createHash("sha256").update(JSON.stringify([jobId, pageNumber, regionId])).digest("hex");
  // UUIDv8 for a deterministic DB row key, not an element/geometry ID scheme.
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-${((parseInt(hash[16], 16) & 3) | 8).toString(16)}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
