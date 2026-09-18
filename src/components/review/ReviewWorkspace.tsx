"use client"

import React, { useState } from "react"
import { CheckCircle2, ShieldCheck, HelpCircle, Layers } from "lucide-react"
import { RegionNavigator } from "./RegionNavigator"
import { SourcePreview } from "./SourcePreview"
import { Tactile3DViewer } from "./Tactile3DViewer"
import { ValidationSummary } from "./ValidationSummary"
import { BraillePreview } from "./BraillePreview"
import { TablePreview } from "./TablePreview"
import { UnsupportedState } from "@/components/shared/UnsupportedState"
import { DocumentOutline } from "./DocumentOutline"
import { ReviewActions } from "./ReviewActions"
import { EditRequestDialog } from "./EditRequestDialog"
import { Badge } from "@/components/ui/badge"
import type { PersistedRegionItem, ReviewStatus } from "@/lib/frontend-types"

interface ReviewWorkspaceProps {
  regions: PersistedRegionItem[]
  onUpdateRegionStatus: (id: string, status: ReviewStatus) => void
  onApplyEdit: (id: string, instruction: string) => Promise<boolean>
  onProceedToExport: () => void
}

export function ReviewWorkspace({
  regions,
  onUpdateRegionStatus,
  onApplyEdit,
  onProceedToExport,
}: ReviewWorkspaceProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isOutlineOpen, setIsOutlineOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  if (!regions || regions.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-neutral-500">
        No regions found for review.
      </div>
    )
  }

  const currentRegion = regions[currentIndex] || regions[0]
  const reviewedCount = regions.filter((r) => r.review_status !== "pending").length
  const totalCount = regions.length
  const allReviewed = reviewedCount === totalCount

  const handleNext = () => {
    if (currentIndex < regions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleApprove = () => {
    onUpdateRegionStatus(currentRegion.id, "approved")
    handleNext()
  }

  const handleReject = () => {
    onUpdateRegionStatus(currentRegion.id, "rejected")
    handleNext()
  }

  const handleSelectRegionById = (id: string) => {
    const idx = regions.findIndex((r) => r.id === id)
    if (idx !== -1) {
      setCurrentIndex(idx)
    }
  }

  const isUnsupportedDiagram =
    currentRegion.type === "diagram" &&
    (!currentRegion.geometry || currentRegion.extracted_data?.status === "failed")

  const isUnsupportedTable =
    currentRegion.type === "table" && currentRegion.extracted_data?.status === "failed"

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      {/* Review Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-400">
            <span>Document</span>
            <span>/</span>
            <span>Page {currentRegion.page_number}</span>
            <span>/</span>
            <span>Region {currentIndex + 1}</span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 mt-1">
            Review generated output
          </h2>
          <p className="text-xs text-neutral-500">
            Compare the source region with Emboss's accessible version before approving it.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs font-semibold text-neutral-900 block">
              {reviewedCount} of {totalCount} reviewed
            </span>
            <span className="text-[11px] text-neutral-400">
              {allReviewed ? "All regions ready" : "Review remaining regions"}
            </span>
          </div>
          <div className="flex size-9 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-800">
            {Math.round((reviewedCount / totalCount) * 100)}%
          </div>
        </div>
      </div>

      {/* Region Navigation Bar */}
      <RegionNavigator
        currentIndex={currentIndex}
        totalRegions={totalCount}
        currentRegion={currentRegion}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToggleSidebar={() => setIsOutlineOpen(!isOutlineOpen)}
        isSidebarOpen={isOutlineOpen}
      />

      {/* Main Workspace Grid */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Document Outline Sidebar */}
        {isOutlineOpen && (
          <div className="w-full lg:w-64 shrink-0">
            <DocumentOutline
              regions={regions}
              currentRegionId={currentRegion.id}
              onSelectRegion={handleSelectRegionById}
              onClose={() => setIsOutlineOpen(false)}
            />
          </div>
        )}

        {/* Side-by-Side Comparison Workspace */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(420px,1.2fr)] gap-6 w-full">
          {/* LEFT: Original Source Panel */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                Original Source
              </span>
              <span className="text-[11px] text-neutral-400">
                Page {currentRegion.page_number}
              </span>
            </div>

            <SourcePreview region={currentRegion} />
          </div>

          {/* RIGHT: Generated Accessible Output Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                Generated Accessible Output
              </span>
              {currentRegion.geometry && (
                <Badge variant="success" className="text-[10px] gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="size-3" />
                  BANA validated
                </Badge>
              )}
            </div>

            {/* Region specific content */}
            {isUnsupportedDiagram ? (
              <UnsupportedState
                type="diagram"
                title="This diagram isn't supported yet"
                reason={
                  currentRegion.extracted_data?.error?.message ||
                  "Emboss supports bar charts and single-series line graphs. Complex, multi-series, or pie charts are excluded."
                }
              />
            ) : isUnsupportedTable ? (
              <UnsupportedState
                type="table"
                title="This table is too complex for automatic conversion"
                reason={
                  currentRegion.extracted_data?.error?.message ||
                  "Emboss supports simple rectangular tables without merged cells per BANA table guidelines."
                }
              />
            ) : currentRegion.type === "diagram" && currentRegion.geometry ? (
              <div className="space-y-3">
                <Tactile3DViewer geometry={currentRegion.geometry} />
                <ValidationSummary warnings={currentRegion.extracted_data?.warnings} />
              </div>
            ) : currentRegion.type === "table" ? (
              <TablePreview data={currentRegion.extracted_data} />
            ) : (
              <BraillePreview data={currentRegion.extracted_data} />
            )}
          </div>
        </div>
      </div>

      {/* Review Actions Bar */}
      <ReviewActions
        currentStatus={currentRegion.review_status}
        onApprove={handleApprove}
        onReject={handleReject}
        onRequestEdit={() => setEditDialogOpen(true)}
        onProceedToExport={onProceedToExport}
        canExport={allReviewed}
        isLastRegion={currentIndex === totalCount - 1}
        isDiagram={currentRegion.type === "diagram" && !isUnsupportedDiagram}
      />

      {/* Edit Correction Request Dialog */}
      <EditRequestDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        region={currentRegion}
        onApplyEdit={(instruction) => onApplyEdit(currentRegion.id, instruction)}
      />
    </div>
  )
}
