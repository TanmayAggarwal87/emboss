import type { PersistedRegionItem } from "../frontend-types.ts";

export function withApprovedRegion(regions: PersistedRegionItem[], regionId: string): PersistedRegionItem[] {
  return regions.map((region) => region.id === regionId ? { ...region, review_status: "approved" } : region);
}

export function countApprovedRegions(regions: PersistedRegionItem[]): number {
  return regions.filter((region) => region.review_status === "approved").length;
}
