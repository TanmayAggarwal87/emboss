import React from "react"
import { Badge } from "@/components/ui/badge"
import { Check, X, AlertTriangle, RefreshCw, HelpCircle, FileText, Table2, BarChart3, TrendingUp, Ban } from "lucide-react"
import type { RegionType, ReviewStatus } from "@/lib/frontend-types"

export function RegionTypeBadge({
  type,
  chartType,
  isUnsupported,
  className,
}: {
  type: RegionType
  chartType?: string
  isUnsupported?: boolean
  className?: string
}) {
  if (isUnsupported) {
    return (
      <Badge variant="outline" className={`gap-1 bg-neutral-100 text-neutral-700 border-neutral-300 ${className ?? ""}`}>
        <Ban className="size-3 text-neutral-500" />
        Unsupported
      </Badge>
    )
  }

  if (type === "text") {
    return (
      <Badge variant="outline" className={`gap-1 bg-neutral-50 text-neutral-700 border-neutral-200 ${className ?? ""}`}>
        <FileText className="size-3 text-neutral-500" />
        Text
      </Badge>
    )
  }

  if (type === "table") {
    return (
      <Badge variant="outline" className={`gap-1 bg-neutral-50 text-neutral-700 border-neutral-200 ${className ?? ""}`}>
        <Table2 className="size-3 text-neutral-500" />
        Table
      </Badge>
    )
  }

  if (type === "diagram") {
    if (chartType === "line_graph_single_series") {
      return (
        <Badge variant="outline" className={`gap-1 bg-blue-50/60 text-blue-800 border-blue-200 ${className ?? ""}`}>
          <TrendingUp className="size-3 text-blue-600" />
          Line graph
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className={`gap-1 bg-blue-50/60 text-blue-800 border-blue-200 ${className ?? ""}`}>
        <BarChart3 className="size-3 text-blue-600" />
        Bar chart
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className={className}>
      {type}
    </Badge>
  )
}

export function ReviewStatusBadge({
  status,
  isEdited,
  className,
}: {
  status: ReviewStatus
  isEdited?: boolean
  className?: string
}) {
  if (isEdited && status === "pending") {
    return (
      <Badge variant="info" className={`gap-1 ${className ?? ""}`}>
        <RefreshCw className="size-3" />
        Updated · Needs review
      </Badge>
    )
  }

  switch (status) {
    case "approved":
      return (
        <Badge variant="success" className={`gap-1 ${className ?? ""}`}>
          <Check className="size-3" />
          Approved
        </Badge>
      )
    case "rejected":
      return (
        <Badge variant="destructive" className={`gap-1 ${className ?? ""}`}>
          <X className="size-3" />
          Excluded
        </Badge>
      )
    case "edit_requested":
      return (
        <Badge variant="info" className={`gap-1 ${className ?? ""}`}>
          <RefreshCw className="size-3" />
          Edit requested
        </Badge>
      )
    case "pending":
    default:
      return (
        <Badge variant="warning" className={`gap-1 ${className ?? ""}`}>
          <HelpCircle className="size-3" />
          Needs review
        </Badge>
      )
  }
}
