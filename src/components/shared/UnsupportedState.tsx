import React from "react"
import { Ban, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface UnsupportedStateProps {
  type: "diagram" | "table"
  title?: string
  reason?: string
  className?: string
}

export function UnsupportedState({
  type,
  title,
  reason,
  className,
}: UnsupportedStateProps) {
  const defaultTitle =
    type === "diagram"
      ? "This diagram isn't supported yet"
      : "This table is too complex for automatic conversion"

  const defaultReason =
    type === "diagram"
      ? "Emboss currently supports bar charts and single-series line graphs. Multi-series line graphs, scatter plots, and pie charts are excluded to ensure physical tactile readability. This region will be omitted from the export package."
      : "Emboss currently supports simple rectangular tables without merged cells. Tables with irregular spans or nested cells are excluded per BANA table guidelines. This region will be omitted from the export package."

  return (
    <div
      className={`rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-neutral-800 ${
        className ?? ""
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-neutral-200/80 p-2.5 text-neutral-600">
          <Ban className="size-5" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-neutral-900">
              {title || defaultTitle}
            </h4>
            <Badge variant="outline" className="border-neutral-300 text-neutral-600 bg-white">
              Unsupported
            </Badge>
          </div>
          <p className="text-sm text-neutral-600 leading-relaxed">
            {reason || defaultReason}
          </p>

          <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
            <Info className="size-3.5 shrink-0 text-neutral-400" />
            <span>This region can be reviewed and will simply not be included in the tactile export.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
