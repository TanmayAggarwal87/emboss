"use client"

import type { ValidationIssue } from "@/lib/tactile-geometry/types"

export function ValidationSummary({ warnings = [], issues = [] }: { warnings?: string[]; issues?: ValidationIssue[] }) {
  return (
    <details className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
      <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-offset-4">
        {issues.length ? "Geometry checks need attention" : "Software accessibility and manufacturing checks passed"}
      </summary>
      <div className="mt-3 space-y-3 text-neutral-700">
        <p>The generated geometry was checked for spacing, fixed paper-braille dimensions, label clearance, source proportions and the configured plate profile.</p>
        <p>Physical print quality and tactile readability still require human verification.</p>
        {issues.length > 0 && <ul className="list-disc space-y-1 pl-5 text-red-800">{issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul>}
        {warnings.length > 0 && <ul className="list-disc space-y-1 pl-5">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      </div>
    </details>
  )
}
