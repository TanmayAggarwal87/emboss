import "server-only";

import { diagramSchema } from "../diagram-extraction/schema.ts";
import { UploadError } from "../document-processing/errors.ts";
import type { GeometryState } from "../tactile-geometry/types.ts";
import { validateGeometry } from "../tactile-geometry/validate.ts";
import { applyValidatedEdit } from "./edit-operations.ts";
import type { EditAgent } from "./gemini-edit-agent.ts";

type RegionRepository = {
  loadEditableRegion(jobId: string, regionId: string): Promise<{ id: string; type: string; extracted_data: unknown; geometry: unknown }>;
  markRegionEditRequested(jobId: string, regionId: string): Promise<void>;
  saveEditedGeometry(jobId: string, regionId: string, geometry: GeometryState): Promise<{ id: string; review_status: "pending"; geometry: unknown }>;
};

export function createRegionEditService(repository: RegionRepository, agent: EditAgent) {
  return async (jobId: string, regionId: string, instruction: string) => {
    const region = await repository.loadEditableRegion(jobId, regionId);
    const geometryResult = safeGeometry(region.geometry);
    const extracted = region.extracted_data as { kind?: unknown; status?: unknown; data?: unknown } | null;
    const chart = diagramSchema.safeParse(extracted?.data);
    if (region.type !== "diagram" || extracted?.kind !== "diagram" || extracted.status !== "processed" ||
      !chart.success || JSON.stringify(chart.data) !== JSON.stringify(geometryResult.source) || validateGeometry(geometryResult).length) {
      throw new UploadError(422, "REGION_NOT_EDITABLE", "Only diagrams with matching, validated source data can be edited.");
    }
    await repository.markRegionEditRequested(jobId, regionId);
    const operation = await agent.propose(geometryResult, instruction, jobId);
    const edited = applyValidatedEdit(geometryResult, operation, instruction);
    return { region: await repository.saveEditedGeometry(jobId, regionId, edited) };
  };
}

function safeGeometry(value: unknown): GeometryState {
  if (typeof value !== "object" || value === null) throw new UploadError(422, "REGION_NOT_EDITABLE", "Validated tactile geometry is not available for this region.");
  return value as GeometryState;
}
