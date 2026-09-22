"use client"

import React, { useRef, useState } from "react"
import { AppHeader } from "@/components/layout/AppHeader"
import { WorkflowStepper } from "@/components/layout/WorkflowStepper"
import { UploadDropzone } from "@/components/upload/UploadDropzone"
import { SelectedFileCard } from "@/components/upload/SelectedFileCard"
import { UploadFeatures } from "@/components/upload/UploadFeatures"
import { ProcessingView } from "@/components/processing/ProcessingView"
import { ReviewWorkspace } from "@/components/review/ReviewWorkspace"
import { ExportView } from "@/components/export/ExportView"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/shared/ErrorState"
import { Badge } from "@/components/ui/badge"
import type {
  WorkflowStep,
  JobApiResponse,
  PersistedRegionItem,
} from "@/lib/frontend-types"

const normalizeRegions = (data: JobApiResponse): PersistedRegionItem[] =>
  (data.pages || []).flatMap((page) => (page.regions || []).map((region) => ({
    ...region,
    page_number: region.page_number ?? page.page_number,
    job_id: region.job_id ?? data.job_id ?? "",
  })))

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
  const requestIdRef = useRef(0)

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
    const activeRequest = ++requestIdRef.current
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
      if (activeRequest !== requestIdRef.current) return
      setJobResponse(data)
      const extractedRegions = normalizeRegions(data)
      if (extractedRegions.length > 0) setRegions(extractedRegions)

      if (!response.ok && extractedRegions.length === 0) {
        setErrorMessage({
          title: "Document processing failed",
          description:
            data.error?.message ||
            "The document could not be processed. Check the page errors below, or choose an unencrypted PDF with 2–3 pages.",
        })
        return
      }

      if (data.status === "ready_for_review" || extractedRegions.length > 0) {
        setCurrentStep("review")
      }
    } catch (err) {
      if (activeRequest !== requestIdRef.current) return
      console.error("Upload error:", err)
      setErrorMessage({
        title: "Connection or processing error",
        description:
          "Could not communicate with the document analysis service. Please verify your connection and try again.",
      })
    } finally {
      if (activeRequest === requestIdRef.current) setIsProcessing(false)
    }
  }

  const handleRetryPages = async (pageNumbers: number[]) => {
    if (!jobResponse?.job_id || isRetrying) return

    setIsRetrying(true)
    const activeRequest = ++requestIdRef.current
    setErrorMessage(null)
    try {
      const response = await fetch(`/api/jobs/${jobResponse.job_id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: pageNumbers }),
      })

      const data: JobApiResponse = await response.json()
      if (activeRequest !== requestIdRef.current) return
      if (!response.ok && !data.pages?.length) {
        setErrorMessage({ title: "Page retry unavailable", description: data.error?.message || "The page could not be retried. Saved results are still available." })
        return
      }
      setJobResponse((previous) => ({ ...previous, ...data }))

      const extractedRegions = normalizeRegions(data)
      if (extractedRegions.length > 0) setRegions((previous) => {
        const incoming = new Map(extractedRegions.map((region) => [region.id, region]))
        return previous.map((region) => incoming.get(region.id) || region).concat(extractedRegions.filter((region) => !previous.some((item) => item.id === region.id)))
      })

      if (data.status === "ready_for_review" || extractedRegions.length > 0) {
        setCurrentStep("review")
      }
    } catch (err) {
      if (activeRequest !== requestIdRef.current) return
      console.error("Retry error:", err)
      setErrorMessage({ title: "Page retry unavailable", description: "Could not reach the service. Saved results are still available." })
    } finally {
      if (activeRequest === requestIdRef.current) setIsRetrying(false)
    }
  }

  const handleReset = () => {
    if (isProcessing || isRetrying) return
    requestIdRef.current += 1
    setCurrentStep("upload")
    setSelectedFile(null)
    setJobResponse(null)
    setRegions([])
    setErrorMessage(null)
    setIsProcessing(false)
  }

  const handleApproveRegion = (regionId: string) => {
    setRegions((current) => current.map((region) => region.id === regionId
      ? { ...region, review_status: "approved" }
      : region))
    setCurrentStep("export")
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-neutral-900 font-sans antialiased">
      {/* Top Application Header */}
      <AppHeader onReset={handleReset} />

      {/* Horizontal Workflow Stepper */}
      <WorkflowStepper currentStep={currentStep} />

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
            {errorMessage && (
              <ErrorState
                title={errorMessage.title}
                description={errorMessage.description}
                actionLabel="Upload another file"
                onAction={handleReset}
              />
            )}
            {(!errorMessage || !!jobResponse?.pages?.length) && (
              <ProcessingView
                jobResponse={jobResponse}
                isLoading={isProcessing}
                onProceedToReview={() => setCurrentStep("review")}
                onRetryPages={handleRetryPages}
                isRetrying={isRetrying}
              />
            )}
            {regions.length > 0 && <Button variant="outline" onClick={() => setCurrentStep("review")}>Return to available previews</Button>}
          </div>
        )}

        {/* STEP 3: REVIEW (THE STAR OF THE PRODUCT) */}
        {currentStep === "review" && (
          <div className="space-y-5">
            <Button variant="outline" onClick={() => setCurrentStep("processing")}>Page processing details</Button>
            <ReviewWorkspace regions={regions} onApprove={handleApproveRegion} />
          </div>
        )}

        {currentStep === "export" && (
          <ExportView fileName={selectedFile?.name ?? "accessible_document.pdf"} regions={regions} onReset={handleReset} />
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
