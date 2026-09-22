import React from "react"
import { ChevronLeft, ChevronRight, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RegionTypeBadge, ReviewStatusBadge } from "@/components/shared/StatusBadge"
import type { PersistedRegionItem } from "@/lib/frontend-types"

interface RegionNavigatorProps {
  currentIndex: number
  totalRegions: number
  currentRegion: PersistedRegionItem
  onPrevious: () => void
  onNext: () => void
  onToggleSidebar?: () => void
  isSidebarOpen?: boolean
}

export function RegionNavigator({
  currentIndex,
  totalRegions,
  currentRegion,
  onPrevious,
  onNext,
  onToggleSidebar,
  isSidebarOpen,
}: RegionNavigatorProps) {
  const chartType = currentRegion.extracted_data?.kind === "diagram" && currentRegion.extracted_data.status === "processed" ? currentRegion.extracted_data.data.chart_type : undefined
  const isUnsupported =
    currentRegion.extracted_data?.status === "failed" ||
    (currentRegion.type === "diagram" && !currentRegion.geometry)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 shadow-xs">
      <div className="flex items-center gap-2 sm:gap-3">
        {onToggleSidebar && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            aria-label="Toggle document overview"
            className={`text-xs gap-1.5 h-8 ${isSidebarOpen ? "bg-neutral-100 text-neutral-900" : "text-neutral-600"}`}
          >
            <List className="size-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </Button>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-900">
            Region {currentIndex + 1} of {totalRegions}
          </span>
          <span className="text-neutral-300">·</span>
          <RegionTypeBadge
            type={currentRegion.type}
            chartType={chartType}
            isUnsupported={isUnsupported}
          />
          <ReviewStatusBadge status={currentRegion.review_status} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={currentIndex <= 0}
          className="h-8 text-xs gap-1 text-neutral-700 disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" />
          <span>Previous</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={currentIndex >= totalRegions - 1}
          className="h-8 text-xs gap-1 text-neutral-700 disabled:opacity-40"
        >
          <span>Next</span>
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
