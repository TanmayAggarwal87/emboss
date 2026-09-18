import React from "react"
import { FileText, Trash2, ArrowRight, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SelectedFileCardProps {
  file: File
  onRemove: () => void
  onProcess: () => void
  isProcessing?: boolean
}

export function SelectedFileCard({
  file,
  onRemove,
  onProcess,
  isProcessing = false,
}: SelectedFileCardProps) {
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900 truncate">
              {file.name}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {formatSize(file.size)} · PDF document
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          disabled={isProcessing}
          aria-label="Remove selected file"
          className="text-neutral-400 hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={isProcessing}
          className="text-xs text-neutral-500 hover:text-neutral-800"
        >
          Change file
        </Button>

        <Button
          type="button"
          size="default"
          onClick={onProcess}
          disabled={isProcessing}
          className="bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-medium gap-2 px-4 h-9 shadow-xs"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="size-3.5 animate-spin" />
              <span>Starting process…</span>
            </>
          ) : (
            <>
              <span>Process document</span>
              <ArrowRight className="size-3.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
