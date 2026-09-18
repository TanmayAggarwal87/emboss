import React from "react"
import { ScanSearch, Cpu, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react"

export function UploadFeatures() {
  return (
    <div className="space-y-10 pt-4">
      {/* 3-Column How It Works */}
      <div>
        <div className="text-center mb-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            How Emboss works
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
            <div className="flex size-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 mb-3 text-xs font-semibold">
              01
            </div>
            <h4 className="text-sm font-semibold text-neutral-900">Analyse</h4>
            <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
              Emboss detects text blocks, simple tables, and supported bar charts and single-series line graphs.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
            <div className="flex size-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 mb-3 text-xs font-semibold">
              02
            </div>
            <h4 className="text-sm font-semibold text-neutral-900">Convert</h4>
            <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
              Text is converted to Grade 2 UEB braille. Charts become tactile 3D relief geometries mathematically verified against BANA rules.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
            <div className="flex size-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 mb-3 text-xs font-semibold">
              03
            </div>
            <h4 className="text-sm font-semibold text-neutral-900">Review</h4>
            <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
              You visually compare generated outputs side-by-side with original regions before exporting printable STL and braille files.
            </p>
          </div>
        </div>
      </div>

      {/* Trust & Deterministic Callout */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-6 sm:p-7">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-neutral-900 mb-2">
            <ShieldCheck className="size-5 text-neutral-900" />
            <h3 className="text-base font-semibold">
              AI interprets. Code validates.
            </h3>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Gemini reads document structures and extracts chart data points. Physical dimensions, heights, bar widths, and tactile spacing are never guessed by an AI model—they are calculated deterministically and checked against BANA 2022 standards.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-neutral-700">
            <span className="rounded-md border border-neutral-200 bg-white px-2.5 py-1">
              AI interpretation
            </span>
            <ArrowRight className="size-3 text-neutral-400" />
            <span className="rounded-md border border-neutral-200 bg-white px-2.5 py-1">
              Deterministic layout
            </span>
            <ArrowRight className="size-3 text-neutral-400" />
            <span className="rounded-md border border-neutral-200 bg-white px-2.5 py-1">
              BANA rule check
            </span>
            <ArrowRight className="size-3 text-neutral-400" />
            <span className="rounded-md border border-neutral-900 bg-neutral-900 text-white px-2.5 py-1">
              Human review
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
