"use client"

import React, { useState } from "react"
import { ZoomIn, ZoomOut, RotateCw, FileText, BarChart3, Table2, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip"
import type { PersistedRegionItem } from "@/lib/frontend-types"

interface SourcePreviewProps {
  region: PersistedRegionItem
  className?: string
}

export function SourcePreview({ region, className }: SourcePreviewProps) {
  const [zoom, setZoom] = useState(1)

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 2.5))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5))
  const handleReset = () => setZoom(1)

  const { bounding_box, page_number, type } = region

  // Extracted raw source text preview (if text or table)
  const plainText =
    region.extracted_data?.plain_text ||
    (region.extracted_data?.headers &&
      `${region.extracted_data.headers.join(" | ")}\n` +
        region.extracted_data.rows?.map((r: string[]) => r.join(" | ")).join("\n"))

  return (
    <TooltipProvider>
      <div className={`relative flex flex-col rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden ${className ?? ""}`}>
        {/* Source Canvas Container */}
        <div className="relative h-[380px] w-full overflow-auto flex items-center justify-center p-6 bg-neutral-100/60">
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
            className="transition-transform duration-150 ease-out"
          >
            {/* Visual Box Container representing the PDF crop / region */}
            <div className="w-[320px] sm:w-[380px] rounded-lg border border-neutral-300 bg-white p-6 shadow-xs text-neutral-800">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-4">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Page {page_number} · Source Region
                </span>
                <span className="text-[11px] font-mono text-neutral-400">
                  [{Math.round(bounding_box.x)}, {Math.round(bounding_box.y)}, {Math.round(bounding_box.width)}, {Math.round(bounding_box.height)}]
                </span>
              </div>

              {plainText ? (
                <div className="max-h-[220px] overflow-y-auto font-sans text-xs text-neutral-800 leading-relaxed whitespace-pre-wrap select-text">
                  {plainText}
                </div>
              ) : type === "diagram" ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-neutral-500 space-y-3">
                  <div className="rounded-lg bg-neutral-100 p-3 text-neutral-700">
                    <BarChart3 className="size-8 stroke-[1.5]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-800">
                      {region.extracted_data?.data?.chart_type === "line_graph_single_series"
                        ? "Single-Series Line Graph"
                        : "Bar Chart"}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-1 max-w-[240px]">
                      Cropped from PDF Page {page_number} at coordinates (x: {Math.round(bounding_box.x)}, y: {Math.round(bounding_box.y)})
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-neutral-400 text-xs">
                  <FileText className="size-8 stroke-1 mb-2 text-neutral-300" />
                  <span>Document region crop</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Floating Zoom Controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 rounded-lg border border-neutral-200 bg-white/90 p-1 shadow-xs backdrop-blur-xs">
          <Tooltip content="Zoom in">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleZoomIn}
              className="size-7 text-neutral-600 hover:text-neutral-900"
            >
              <ZoomIn className="size-3.5" />
            </Button>
          </Tooltip>

          <Tooltip content="Reset zoom">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleReset}
              className="size-7 text-neutral-600 hover:text-neutral-900"
            >
              <RotateCw className="size-3.5" />
            </Button>
          </Tooltip>

          <Tooltip content="Zoom out">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleZoomOut}
              className="size-7 text-neutral-600 hover:text-neutral-900"
            >
              <ZoomOut className="size-3.5" />
            </Button>
          </Tooltip>
        </div>

        {/* Bottom meta footer */}
        <div className="flex items-center justify-between border-t border-neutral-200 bg-white/80 px-3 py-1.5 text-[11px] text-neutral-500">
          <span>Source crop: {Math.round(bounding_box.width)} × {Math.round(bounding_box.height)} pt</span>
          <span className="font-mono text-neutral-400">Zoom: {Math.round(zoom * 100)}%</span>
        </div>
      </div>
    </TooltipProvider>
  )
}
