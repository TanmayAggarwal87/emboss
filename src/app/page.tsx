"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
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
import { Download } from "lucide-react"
import type {
  WorkflowStep,
  JobApiResponse,
  PersistedRegionItem,
} from "@/lib/frontend-types"
import { withApprovedRegion, withEditedRegion, withRejectedRegion } from "@/lib/review/approval-state"

const samplePdfs = [
  { file: "emboss_realistic_book_page.pdf", label: "Book page", pages: 1 },
  { file: "emboss_bar_chart_test.pdf", label: "Bar chart", pages: 2 },
  { file: "emboss_line_graph_test.pdf", label: "Line graph", pages: 2 },
  { file: "emboss_table_and_chart_test.pdf", label: "Table and chart", pages: 2 },
] as const

type UploadQuota = { remaining: number; limit: number }

async function readUploadQuota(): Promise<UploadQuota | null> {
  try {
    const response = await fetch("/api/upload", { cache: "no-store" })
    if (!response.ok) return null
    const quota: UploadQuota = await response.json()
    if (!Number.isInteger(quota.limit) || quota.limit < 1 || !Number.isInteger(quota.remaining) ||
      quota.remaining < 0 || quota.remaining > quota.limit) return null
    return quota
  } catch {
    return null
  }
}

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
  const [approvingRegionId, setApprovingRegionId] = useState<string | null>(null)
  const [rejectingRegionId, setRejectingRegionId] = useState<string | null>(null)
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null)
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [jobResponse, setJobResponse] = useState<JobApiResponse | null>(null)
  const [regions, setRegions] = useState<PersistedRegionItem[]>([])
  const [errorMessage, setErrorMessage] = useState<{
    title: string
    description: string
  } | null>(null)
  const [uploadQuota, setUploadQuota] = useState<UploadQuota | null>(null)
  const requestIdRef = useRef(0)

  const refreshUploadQuota = useCallback(async () => {
    setUploadQuota(await readUploadQuota())
  }, [])

  useEffect(() => {
    let active = true
    void readUploadQuota().then((quota) => { if (active) setUploadQuota(quota) })
    return () => { active = false }
  }, [])

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
            "The document could not be processed. Check the page errors below, or choose an unencrypted PDF with 1–3 pages.",
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
      void refreshUploadQuota()
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
      void refreshUploadQuota()
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

  const handleApproveRegion = async (regionId: string) => {
    if (!jobResponse?.job_id || approvingRegionId || rejectingRegionId) return
    setApprovingRegionId(regionId)
    setApprovalError(null)
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobResponse.job_id)}/regions/${encodeURIComponent(regionId)}/approve`, { method: "POST" })
      const result = await response.json() as { region?: { id: string; review_status: "approved" }; error?: { message?: string } }
      if (!response.ok || result.region?.review_status !== "approved") {
        setApprovalError(result.error?.message || "This region could not be approved. Please try again.")
        return
      }
      setRegions((current) => withApprovedRegion(current, result.region!.id))
    } catch {
      setApprovalError("Could not save this approval. Check your connection and try again.")
    } finally {
      setApprovingRegionId(null)
    }
  }

  const handleRejectRegion = async (regionId: string) => {
    if (!jobResponse?.job_id || approvingRegionId || rejectingRegionId) return
    setRejectingRegionId(regionId)
    setApprovalError(null)
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobResponse.job_id)}/regions/${encodeURIComponent(regionId)}/reject`, { method: "POST" })
      const result = await response.json() as { region?: { id: string; review_status: "rejected" }; error?: { message?: string } }
      if (!response.ok || result.region?.review_status !== "rejected") {
        setApprovalError(result.error?.message || "This region could not be excluded. Please try again.")
        return
      }
      setRegions((current) => withRejectedRegion(current, result.region!.id))
    } catch {
      setApprovalError("Could not save this exclusion. Check your connection and try again.")
    } finally {
      setRejectingRegionId(null)
    }
  }

  const handleEditRegion = async (regionId: string, instruction: string): Promise<boolean> => {
    if (!jobResponse?.job_id || approvingRegionId || rejectingRegionId || editingRegionId) return false
    setEditingRegionId(regionId)
    setApprovalError(null)
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobResponse.job_id)}/regions/${encodeURIComponent(regionId)}/edit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction }),
      })
      const result = await response.json() as { region?: { id: string; geometry: PersistedRegionItem["geometry"]; review_status: "pending" }; error?: { message?: string } }
      if (!response.ok || result.region?.review_status !== "pending" || !result.region.geometry) {
        setApprovalError(result.error?.message || "This edit could not be applied; the saved geometry remains available.")
        return false
      }
      setRegions((current) => withEditedRegion(current, result.region!))
      return true
    } catch {
      setApprovalError("Could not apply this edit. The saved geometry remains available.")
      return false
    } finally { setEditingRegionId(null) }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-neutral-900 font-sans antialiased">
      {/* Top Application Header */}
      <AppHeader onReset={handleReset} uploadQuota={uploadQuota} />

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
              <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
                <p className="text-sm font-semibold text-neutral-900">Try a sample PDF</p>
                <p className="mt-1 text-xs text-neutral-500">Download a sample, then upload it above.</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {samplePdfs.map((sample) => (
                    <a
                      key={sample.file}
                      href={`/samples/${sample.file}`}
                      download={sample.file}
                      className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-800 transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                      aria-label={`Download ${sample.label} sample PDF, ${sample.pages} ${sample.pages === 1 ? "page" : "pages"}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{sample.label}</span>
                        <span className="block text-xs text-neutral-500">{sample.pages} {sample.pages === 1 ? "page" : "pages"} · PDF</span>
                      </span>
                      <Download className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
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
            {approvalError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{approvalError}</p>}
            <ReviewWorkspace regions={regions} onApprove={handleApproveRegion} onExport={() => setCurrentStep("export")}
              onReject={handleRejectRegion} onEdit={handleEditRegion} approvingRegionId={approvingRegionId} rejectingRegionId={rejectingRegionId}
              editingRegionId={editingRegionId} />
          </div>
        )}

        {currentStep === "export" && (
          <ExportView fileName={selectedFile?.name ?? "accessible_document.pdf"} regions={regions} onReset={handleReset}
            onBack={() => setCurrentStep("review")} />
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
