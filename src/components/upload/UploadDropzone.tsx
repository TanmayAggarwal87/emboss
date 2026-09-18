"use client"

import React, { useState, useRef } from "react"
import { FileUp, FileText, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

const MAX_SIZE_MB = 7
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
}

export function UploadDropzone({ onFileSelect, disabled }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setClientError(null)

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setClientError("Only PDF files are supported. Please upload a standard PDF document.")
      return
    }

    if (file.size > MAX_SIZE_BYTES) {
      setClientError(`This PDF is larger than ${MAX_SIZE_MB} MB. Please upload a file smaller than ${MAX_SIZE_MB} MB.`)
      return
    }

    onFileSelect(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  return (
    <div className="w-full space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-150",
          isDragging
            ? "border-neutral-900 bg-blue-50/40"
            : "border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50/50",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0])
            }
          }}
        />

        <div className="flex size-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 mb-4">
          <FileUp className="size-6" />
        </div>

        <h3 className="text-base font-semibold text-neutral-900">
          Upload a PDF
        </h3>
        <p className="mt-1 text-xs text-neutral-500 max-w-sm">
          Drag and drop your document here, or choose a file from your computer
        </p>

        <div className="mt-5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs font-medium border-neutral-300 bg-white shadow-xs hover:bg-neutral-50"
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
          >
            Choose PDF
          </Button>
        </div>

        <div className="mt-6 border-t border-neutral-200/80 pt-3 text-[11px] text-neutral-500 font-medium">
          PDF only · Up to 3 pages · Maximum 7 MB
        </div>
      </div>

      {clientError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Upload restriction</AlertTitle>
          <AlertDescription>{clientError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
