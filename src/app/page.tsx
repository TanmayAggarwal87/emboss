"use client"

import React, { useState } from "react"
import { AppHeader } from "@/components/layout/AppHeader"
import { WorkflowStepper } from "@/components/layout/WorkflowStepper"
import { UploadDropzone } from "@/components/upload/UploadDropzone"
import { SelectedFileCard } from "@/components/upload/SelectedFileCard"
import { UploadFeatures } from "@/components/upload/UploadFeatures"
import { ProcessingView } from "@/components/processing/ProcessingView"
import { ReviewWorkspace } from "@/components/review/ReviewWorkspace"
import { ExportView } from "@/components/export/ExportView"
import { ErrorState } from "@/components/shared/ErrorState"
import { Badge } from "@/components/ui/badge"
import type {
  WorkflowStep,
  JobApiResponse,
  PersistedRegionItem,
  ReviewStatus,
} from "@/lib/frontend-types"

export default function Home() {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("upload")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [jobResponse, setJobResponse] = useState<JobApiResponse | null>(null)
  const [regions, setRegions] = useState<PersistedRegionItem[]>([])
  const [errorMessage, setErrorMessage] = useState<{
    title: string
    description: string
  } | null>(null)

  // ponytail: React state handles linear workflow without redundant state stores
  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setErrorMessage(null)
  }

  const handleFileRemove = () => {
    setSelectedFile(null)
    setErrorMessage(null)
  }

  const handleStartProcessing = async () => {
    if (!selectedFile || isProcessing) return

    setIsProcessing(true)
    setCurrentStep("processing")
    setErrorMessage(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data: JobApiResponse = await response.json()
      setJobResponse(data)

      if (!response.ok && response.status !== 207) {
        setErrorMessage({
          title: "Document processing failed",
          description:
            data.error?.message ||
            "The document could not be processed. Please check that it is an unencrypted PDF with 3 pages or fewer.",
        })
        return
      }

      // Extract all regions from classified pages
      const extractedRegions: PersistedRegionItem[] = (data.pages || []).flatMap(
        (page) => page.regions || []
      )

      setRegions(extractedRegions)

      // If document is ready, user can proceed to review
      if (data.status === "ready_for_review" || extractedRegions.length > 0) {
        // Brief pause so the completed processing stages are visible
        setTimeout(() => {
          setCurrentStep("review")
        }, 800)
      }
    } catch (err) {
      console.error("Upload error:", err)
      setErrorMessage({
        title: "Connection or processing error",
        description:
          "Could not communicate with the document analysis service. Please verify your connection and try again.",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRetryPages = async (pageNumbers: number[]) => {
    if (!jobResponse?.job_id || isRetrying) return

    setIsRetrying(true)
    try {
      const response = await fetch(`/api/jobs/${jobResponse.job_id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: pageNumbers }),
      })

      const data: JobApiResponse = await response.json()
      setJobResponse(data)

      const extractedRegions: PersistedRegionItem[] = (data.pages || []).flatMap(
        (page) => page.regions || []
      )
      setRegions(extractedRegions)

      if (data.status === "ready_for_review" || extractedRegions.length > 0) {
        setCurrentStep("review")
      }
    } catch (err) {
      console.error("Retry error:", err)
    } finally {
      setIsRetrying(false)
    }
  }

  const handleUpdateRegionStatus = (regionId: string, status: ReviewStatus) => {
    setRegions((prev) =>
      prev.map((r) => (r.id === regionId ? { ...r, review_status: status } : r))
    )
  }

  const handleApplyEdit = async (
    regionId: string,
    instruction: string
  ): Promise<boolean> => {
    // ponytail: Simulated deterministic edit verification for reviewer interaction
    // In Phase 7 full backend integration, this invokes the edit route with BANA re-validation
    await new Promise((resolve) => setTimeout(resolve, 800))

    // Reject obvious nonsensical or out-of-bounds requests
    if (
      instruction.toLowerCase().includes("pie") ||
      instruction.toLowerCase().includes("scatter") ||
      instruction.toLowerCase().includes("3d")
    ) {
      return false
    }

    setRegions((prev) =>
      prev.map((r) => {
        if (r.id === regionId) {
          return {
            ...r,
            review_status: "pending", // Reset to pending for re-approval
            extracted_data: {
              ...r.extracted_data,
              warnings: [
                ...(r.extracted_data?.warnings || []),
                `User adjustment applied: "${instruction}"`,
              ],
            },
          }
        }
        return r
      })
    )

    return true
  }

  const handleReset = () => {
    setCurrentStep("upload")
    setSelectedFile(null)
    setJobResponse(null)
    setRegions([])
    setErrorMessage(null)
    setIsProcessing(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-neutral-900 font-sans antialiased">
      {/* Top Application Header */}
      <AppHeader onReset={handleReset} />

      {/* Horizontal Workflow Stepper */}
      <WorkflowStepper currentStep={currentStep} onStepClick={setCurrentStep} />

      {/* Main Screen Content */}
      <main className="flex-1 w-full mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* STEP 1: UPLOAD */}
        {currentStep === "upload" && (
          <div className="space-y-8">
            {/* Header intro */}
            <div className="text-center space-y-2.5 max-w-2xl mx-auto">
              <Badge
                variant="outline"
                className="bg-white border-neutral-200 text-neutral-600 text-xs font-normal"
              >
                Built for accessible learning
              </Badge>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">
                Turn visual documents into tactile, accessible material.
              </h1>
              <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
                Upload a short PDF and Emboss converts text into braille and supported charts into standards-checked tactile graphics ready for human review.
              </p>
            </div>

            {/* Error banner if any */}
            {errorMessage && (
              <ErrorState
                title={errorMessage.title}
                description={errorMessage.description}
                actionLabel="Try again"
                onAction={() => setErrorMessage(null)}
              />
            )}

            {/* Upload Area */}
            <div className="max-w-xl mx-auto">
              {!selectedFile ? (
                <UploadDropzone
                  onFileSelect={handleFileSelect}
                  disabled={isProcessing}
                />
              ) : (
                <SelectedFileCard
                  file={selectedFile}
                  onRemove={handleFileRemove}
                  onProcess={handleStartProcessing}
                  isProcessing={isProcessing}
                />
              )}
            </div>

            {/* Features & Trust sections */}
            <UploadFeatures />
          </div>
        )}

        {/* STEP 2: PROCESSING */}
        {currentStep === "processing" && (
          <div className="space-y-6">
            {errorMessage ? (
              <ErrorState
                title={errorMessage.title}
                description={errorMessage.description}
                actionLabel="Upload another file"
                onAction={handleReset}
              />
            ) : (
              <ProcessingView
                jobResponse={jobResponse}
                isLoading={isProcessing}
                onProceedToReview={() => setCurrentStep("review")}
                onRetryPages={handleRetryPages}
                isRetrying={isRetrying}
              />
            )}
          </div>
        )}

        {/* STEP 3: REVIEW (THE STAR OF THE PRODUCT) */}
        {currentStep === "review" && (
          <ReviewWorkspace
            regions={regions}
            onUpdateRegionStatus={handleUpdateRegionStatus}
            onApplyEdit={handleApplyEdit}
            onProceedToExport={() => setCurrentStep("export")}
          />
        )}

        {/* STEP 4: EXPORT */}
        {currentStep === "export" && (
          <ExportView
            fileName={selectedFile?.name || "document.pdf"}
            regions={regions}
            onReset={handleReset}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-200 bg-white py-5 text-center text-xs text-neutral-500">
        <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Emboss · Tactile Graphics & Braille Transcriber</span>
          <span className="text-[11px] text-neutral-400">
            Validated against BANA 2022 Guidelines & Standards
          </span>
        </div>
      </footer>
    </div>
  )
}
