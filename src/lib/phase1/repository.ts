import "server-only";

import { getSupabaseAdmin } from "../supabase/admin.ts";
import { UploadError } from "./errors.ts";
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

    const { data, error } = await getSupabaseAdmin()
      .from("regions")
      .insert(
        regions.map((region) => ({
          job_id: jobId,
          page_number: pageNumber,
          type: region.type,
          bounding_box: region.bounding_box,
          review_status: "pending" as const,
          extracted_data: region.extracted_data ?? null,
        })),
      )
      .select("id, type, bounding_box, review_status, extracted_data");

    if (error) {
      throw new UploadError(
        503,
        "DATABASE_ERROR",
        `Page ${pageNumber} was classified, but its regions could not be saved.`,
      );
    }

    return data as PersistedRegion[];
  }

  async markJobFailed(jobId: string, message: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from("jobs")
      .update({ status: "failed", error_message: message })
      .eq("id", jobId);

    if (error) {
      console.error("Failed to mark an unsuccessful Phase 1 job as failed.");
    }
  }
}
