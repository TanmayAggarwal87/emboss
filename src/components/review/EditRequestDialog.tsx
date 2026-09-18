"use client"

import React, { useState } from "react"
import { Pencil, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import type { PersistedRegionItem } from "@/lib/frontend-types"

interface EditRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  region: PersistedRegionItem
  onApplyEdit: (instruction: string) => Promise<boolean>
}

export function EditRequestDialog({
  open,
  onOpenChange,
  region,
  onApplyEdit,
}: EditRequestDialogProps) {
  const [instruction, setInstruction] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  const handleClose = () => {
    if (isSubmitting) return
    setStatusMessage(null)
    setInstruction("")
    onOpenChange(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!instruction.trim() || isSubmitting) return

    setIsSubmitting(true)
    setStatusMessage(null)

    try {
      const success = await onApplyEdit(instruction.trim())
      if (success) {
        setStatusMessage({
          type: "success",
          text: "Correction applied and deterministic BANA validation passed.",
        })
        setTimeout(() => {
          handleClose()
        }, 1200)
      } else {
        setStatusMessage({
          type: "error",
          text: "The requested adjustment violates BANA 2022 minimum clearance standards (≥2.5mm) or refers to an unsupported attribute.",
        })
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "Could not apply correction. Please verify the instruction and try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex size-7 items-center justify-center rounded-md bg-neutral-100 text-neutral-800">
              <Pencil className="size-3.5" />
            </div>
            <DialogTitle>Request a correction</DialogTitle>
          </div>
          <DialogDescription>
            Describe what should change in this tactile graphic. Code will revalidate all tactile minimums.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="For example: increase the spacing between bars, or adjust the y-axis label position."
              disabled={isSubmitting}
              className="h-28 text-xs resize-none"
              required
            />
            <p className="text-[11px] text-neutral-500">
              Edits are revalidated deterministically before they can be approved.
            </p>
          </div>

          {statusMessage && (
            <Alert
              variant={statusMessage.type === "success" ? "success" : "destructive"}
              className="py-2.5"
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <AlertCircle className="size-4" />
              )}
              <AlertDescription className="text-xs">
                {statusMessage.text}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!instruction.trim() || isSubmitting}
              className="text-xs bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin mr-1.5" />
                  Applying correction…
                </>
              ) : (
                "Apply edit"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
