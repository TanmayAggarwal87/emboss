import type { PersistedRegionItem } from "../frontend-types.ts";

export function withApprovedRegion(regions: PersistedRegionItem[], regionId: string): PersistedRegionItem[] {
  return regions.map((region) => region.id === regionId ? { ...region, review_status: "approved" } : region);
}

export function withRejectedRegion(regions: PersistedRegionItem[], regionId: string): PersistedRegionItem[] {
  return regions.map((region) => region.id === regionId ? { ...region, review_status: "rejected" } : region);
}

export function withEditedRegion(regions: PersistedRegionItem[], updated: { id: string; geometry: PersistedRegionItem["geometry"]; review_status: "pending" }): PersistedRegionItem[] {
  return regions.map((region) => region.id === updated.id ? { ...region, geometry: updated.geometry, review_status: "pending" } : region);
}
