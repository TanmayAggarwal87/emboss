import { Check, X, Circle } from "lucide-react"
import type { PersistedRegionItem } from "@/lib/frontend-types"

interface DocumentOutlineProps {
  regions: PersistedRegionItem[]
  currentRegionId: string
  onSelectRegion: (id: string) => void
  onClose?: () => void
}

export function DocumentOutline({
  regions,
  currentRegionId,
  onSelectRegion,
  onClose,
}: DocumentOutlineProps) {
  // Group regions by page
  const pagesMap = new Map<number, PersistedRegionItem[]>()
  regions.forEach((region) => {
    const list = pagesMap.get(region.page_number) || []
    list.push(region)
    pagesMap.set(region.page_number, list)
  })

  const pageNumbers = Array.from(pagesMap.keys()).sort((a, b) => a - b)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <Check className="size-3 text-emerald-600 stroke-[2.5]" />
      case "rejected":
        return <X className="size-3 text-red-500 stroke-[2.5]" />
      case "pending":
      default:
        return <Circle className="size-2 text-amber-500 fill-amber-500" />
    }
  }

  const getTypeLabel = (region: PersistedRegionItem) => {
    if (region.type === "text") return "Text block"
    if (region.type === "table") return "Table"
    if (region.type === "diagram") {
      return region.extracted_data?.kind === "diagram" && region.extracted_data.status === "processed" && region.extracted_data.data.chart_type === "line_graph_single_series"
        ? "Line graph"
        : "Bar chart"
    }
    return "Region"
  }

  return (
    <div className="w-full sm:w-64 shrink-0 rounded-lg border border-neutral-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Document Outline
        </h4>
        <span className="text-[11px] text-neutral-400">
          {regions.filter((r) => r.review_status === "approved").length} of {regions.length} approved
        </span>
      </div>

      <div className="mt-3 space-y-4 max-h-[480px] overflow-y-auto pr-1">
        {pageNumbers.map((pageNo) => {
          const pageRegions = pagesMap.get(pageNo) || []

          return (
            <div key={pageNo} className="space-y-1">
              <div className="text-[11px] font-semibold text-neutral-400 px-2 py-0.5">
                Page {pageNo}
              </div>

              <div className="space-y-0.5">
                {pageRegions.map((region) => {
                  const isSelected = region.id === currentRegionId

                  return (
                    <button
                      key={region.id}
                      type="button"
                      onClick={() => {
                        onSelectRegion(region.id)
                        onClose?.()
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs text-left transition-colors ${
                        isSelected
                          ? "bg-neutral-900 text-white font-medium shadow-xs"
                          : "text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="shrink-0">
                          {getStatusIcon(region.review_status)}
                        </span>
                        <span className="truncate">{getTypeLabel(region)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
