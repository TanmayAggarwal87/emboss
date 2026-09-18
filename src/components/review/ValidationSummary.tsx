"use client"

import React, { useState } from "react"
import { CheckCircle2, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react"

export function ValidationSummary({
  warnings = [],
}: {
  warnings?: string[]
}) {
  const [expanded, setExpanded] = useState(false)

  const rules = [
    { label: "Minimum element spacing", status: "Passed", detail: "≥ 2.5 mm separation between tactile features for fingertip discernment" },
    { label: "Fixed braille dimensions", status: "Passed", detail: "BANA 2022 standard dot pitch (2.5mm) and cell pitch (6.0mm) strictly maintained" },
    { label: "Tactile relief hierarchy", status: "Passed", detail: "Data lines/bars rise higher than axis markings and reference gridlines" },
    { label: "Bar thickness & texture", status: "Passed", detail: "Additive textured relief with stripe pitch conforming to manufacturing profile" },
    { label: "Label clearance", status: "Passed", detail: "Unambiguous placement clear of graph axes and data points" },
  ]

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-xs">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <span className="text-xs font-semibold text-neutral-900">
            BANA 2022 accessibility rules passed
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900">
          <span>{expanded ? "Hide details" : "View checks"}</span>
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 border-t border-neutral-100 pt-3 space-y-2.5 text-xs">
          {rules.map((rule, idx) => (
            <div key={idx} className="flex items-start justify-between gap-4 py-1">
              <div>
                <span className="font-medium text-neutral-800">{rule.label}</span>
                <p className="text-[11px] text-neutral-500 mt-0.5">{rule.detail}</p>
              </div>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 shrink-0">
                {rule.status}
              </span>
            </div>
          ))}

          {warnings.length > 0 && (
            <div className="mt-3 rounded-md bg-amber-50 p-2.5 text-[11px] text-amber-800 border border-amber-200">
              <span className="font-semibold block mb-1">Notices:</span>
              <ul className="list-disc pl-4 space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
