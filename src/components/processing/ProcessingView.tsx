"use client"

import React, { useState, useEffect } from "react"
import { CheckCircle2, Loader2, Circle, AlertTriangle, ArrowRight, RotateCw } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import type { JobApiResponse, PageSummary } from "@/lib/frontend-types"

interface ProcessingViewProps {
  jobResponse: JobApiResponse | null
  isLoading: boolean
  onProceedToReview: () => void
  onRetryPages?: (pages: number[]) => void
  isRetrying?: boolean
}

const STAGES = [
  { id: "prepare", label: "Preparing pages and rasterizing" },
  { id: "classify", label: "Detecting content regions" },
  { id: "text_table", label: "Converting text and tables to braille" },
  { id: "tactile", label: "Generating tactile 3D graphics" },
  { id: "validate", label: "Running BANA accessibility validation" },
]

export function ProcessingView({
  jobResponse,
  isLoading,
  onProceedToReview,
  onRetryPages,
  isRetrying = false,
}: ProcessingViewProps) {
  const [activeStageIndex, setActiveStageIndex] = useState(0)

  // Calmer simulation of stage progression when waiting for backend response
  useEffect(() => {
    if (!isLoading) {
      setActiveStageIndex(STAGES.length - 1)
      return
    }

    const interval = setInterval(() => {
      setActiveStageIndex((prev) => (prev < STAGES.length - 2 ? prev + 1 : prev))
    }, 2500)

    return () => clearInterval(interval)
  }, [isLoading])

  const totalPages = jobResponse?.page_count || 1
  const pages: PageSummary[] = jobResponse?.pages || []
  const hasPartialFailures = pages.some(
    (p) =>
      p.status === "failed" ||
      p.text_processing === "partial_failure" ||
      p.table_processing === "partial_failure" ||
      p.diagram_processing === "partial_failure" ||
      p.geometry_processing === "partial_failure"
  )
  const isJobFailed = jobResponse?.status === "failed"
  const canProceed = !isLoading && !isJobFailed && (jobResponse?.status === "ready_for_review" || pages.length > 0)
  const retryablePages = jobResponse?.retry?.eligible_pages || []

  // Progress percentage calculation
  const progressPercent = isLoading
    ? Math.min((activeStageIndex + 1) * 20, 85)
    : isJobFailed
    ? 100
    : 100

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
          {isJobFailed
            ? "Document processing incomplete"
            : isLoading
            ? "Preparing your accessible document"
            : "Document analysis complete"}
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          {isJobFailed
            ? "Some or all regions could not be converted. Check details below."
            : isLoading
            ? "Emboss is analysing each page and generating accessible braille and tactile graphics."
            : "Your document is ready for visual comparison and tactile review."}
        </p>
      </div>

      {/* Main Progress Card */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-neutral-900">
              {isLoading ? "Processing pipeline" : "Pipeline complete"}
            </span>
            <span className="font-mono text-neutral-500">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Vertical Pipeline Stages */}
        <div className="space-y-3 border-t border-neutral-100 pt-4">
          {STAGES.map((stage, index) => {
            const isDone = !isLoading || index < activeStageIndex
            const isCurrent = isLoading && index === activeStageIndex
            const isPending = isLoading && index > activeStageIndex

            return (
              <div key={stage.id} className="flex items-center gap-3 text-xs">
                {isDone ? (
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="size-4 text-neutral-900 animate-spin shrink-0" />
                ) : (
                  <Circle className="size-4 text-neutral-300 shrink-0" />
                )}

                <span
                  className={
                    isDone
                      ? "text-neutral-700 font-medium"
                      : isCurrent
                      ? "text-neutral-900 font-semibold"
                      : "text-neutral-400"
                  }
                >
                  {stage.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pages Summary */}
      {pages.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Page status breakdown
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pages.map((page) => {
              const textCount = page.regions?.filter((r) => r.type === "text").length || 0
              const tableCount = page.regions?.filter((r) => r.type === "table").length || 0
              const diagramCount = page.regions?.filter((r) => r.type === "diagram").length || 0
              const isPageFailed = page.status === "failed"

              return (
                <div
                  key={page.page_number}
                  className={`rounded-lg border p-4 text-xs ${
                    isPageFailed
                      ? "border-red-200 bg-red-50/40"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-neutral-900">
                      Page {page.page_number}
                    </span>
                    {isPageFailed ? (
                      <Badge variant="destructive">Failed</Badge>
                    ) : (
                      <Badge variant="success">Completed</Badge>
                    )}
                  </div>

                  {isPageFailed ? (
                    <p className="text-neutral-600 mt-1">
                      {page.error || "Failed to process page."}
                    </p>
                  ) : (
                    <div className="flex items-center gap-3 text-neutral-500 mt-2">
                      <span>{textCount} text</span>
                      <span>·</span>
                      <span>{tableCount} tables</span>
                      <span>·</span>
                      <span>{diagramCount} charts</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Failure alert & actions */}
      {hasPartialFailures && (
        <Alert variant="warning">
          <AlertTriangle className="size-4" />
          <AlertTitle>Non-critical warning</AlertTitle>
          <AlertDescription>
            One or more regions could not be automatically converted. The rest of your document was processed successfully and can still be reviewed.
          </AlertDescription>
        </Alert>
      )}

      {/* Bottom Actions */}
      <div className="flex items-center justify-between pt-2">
        {retryablePages.length > 0 && onRetryPages ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRetryPages(retryablePages)}
            disabled={isRetrying}
            className="text-xs gap-1.5"
          >
            <RotateCw className={`size-3.5 ${isRetrying ? "animate-spin" : ""}`} />
            <span>Retry failed pages</span>
          </Button>
        ) : (
          <div />
        )}

        {canProceed && (
          <Button
            size="default"
            onClick={onProceedToReview}
            className="bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-medium gap-2 px-5 h-9 ml-auto"
          >
            <span>Continue to review</span>
            <ArrowRight className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
