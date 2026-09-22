"use client"

import React, { useState } from "react"
import { Copy, Check, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TableExtractedData } from "@/lib/frontend-types"

export function TablePreview({ data }: { data?: TableExtractedData | null }) {
  const [copied, setCopied] = useState(false)

  const processed = data?.status === "processed" ? data : undefined
  const headers = processed?.headers || []
  const rows = processed?.rows || []
  const braillePages = processed?.braille_pages || []
  const brailleTable = braillePages.join("\n\n---\n\n") || "No braille table available."
  const layout = processed?.layout || "aligned"

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(brailleTable)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Copy failed", err)
    }
  }

  return (
    <div className="flex flex-col rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-xs">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Table2 className="size-4 text-neutral-600" />
          <h4 className="text-xs font-semibold text-neutral-900">
            Braille table formatting
          </h4>
          <Badge variant="outline" className="text-[10px] bg-white text-neutral-600 border-neutral-200">
            {layout === "aligned" ? "BANA Aligned" : "Vertical List"}
          </Badge>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="text-xs gap-1.5 h-7 bg-white hover:bg-neutral-50"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-600" />
              <span className="text-emerald-700">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy table</span>
            </>
          )}
        </Button>
      </div>

      <div className="p-6 h-[340px] overflow-y-auto bg-white">
        <div className="font-mono text-sm tracking-widest leading-loose text-neutral-900 whitespace-pre select-all">
          {brailleTable}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50/70 px-4 py-2 text-[11px] text-neutral-500">
        <span>BANA 2022 §8 table rules (3-cell spacing & guide railing)</span>
        <span>{rows.length} rows · {headers.length} columns</span>
      </div>
    </div>
  )
}
