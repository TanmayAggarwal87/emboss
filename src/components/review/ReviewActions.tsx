import React from "react"
import { Check, X, Pencil, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ReviewStatus } from "@/lib/frontend-types"

interface ReviewActionsProps {
  currentStatus: ReviewStatus
  onApprove: () => void
  onReject: () => void
  onRequestEdit: () => void
  onProceedToExport?: () => void
  canExport?: boolean
  isLastRegion?: boolean
  isDiagram?: boolean
}

export function ReviewActions({
  currentStatus,
  onApprove,
  onReject,
  onRequestEdit,
  onProceedToExport,
  canExport = false,
  isDiagram = false,
}: ReviewActionsProps) {
  return (
    <div className="sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-white/95 px-4 sm:px-6 py-3 shadow-sm backdrop-blur-xs">
      {/* Left: Reject button */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReject}
          className={`h-9 text-xs gap-1.5 transition-colors ${
            currentStatus === "rejected"
              ? "border-red-300 bg-red-50/70 text-red-700"
              : "border-neutral-200 text-neutral-600 hover:text-red-700 hover:bg-red-50/50"
          }`}
        >
          <X className="size-3.5" />
          <span>{currentStatus === "rejected" ? "Excluded" : "Reject"}</span>
        </Button>

        {isDiagram && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRequestEdit}
            className={`h-9 text-xs gap-1.5 transition-colors ${
              currentStatus === "edit_requested"
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            <Pencil className="size-3.5" />
            <span>Request edit</span>
          </Button>
        )}
      </div>

      {/* Right: Approve & Finish buttons */}
      <div className="flex items-center gap-2.5 ml-auto">
        <Button
          type="button"
          size="sm"
          onClick={onApprove}
          className={`h-9 text-xs gap-1.5 px-4 transition-colors font-medium shadow-xs ${
            currentStatus === "approved"
              ? "bg-emerald-700 text-white hover:bg-emerald-800"
              : "bg-neutral-900 text-white hover:bg-neutral-800"
          }`}
        >
          <Check className="size-3.5 stroke-[2.5]" />
          <span>{currentStatus === "approved" ? "Approved" : "Approve"}</span>
        </Button>

        {canExport && onProceedToExport && (
          <Button
            type="button"
            size="sm"
            onClick={onProceedToExport}
            className="h-9 text-xs gap-1.5 px-4 bg-emerald-600 text-white hover:bg-emerald-700 font-medium shadow-xs"
          >
            <span>Proceed to export</span>
            <ArrowRight className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
