"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { RegionNavigator } from "./RegionNavigator"
import { SourcePreview } from "./SourcePreview"
import { ValidationSummary } from "./ValidationSummary"
import { BraillePreview } from "./BraillePreview"
import { TablePreview } from "./TablePreview"
import { DocumentOutline } from "./DocumentOutline"
import { Badge } from "@/components/ui/badge"
import type { PersistedRegionItem } from "@/lib/frontend-types"
import { validateGeometry } from "@/lib/tactile-geometry/validate"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import { EditRequestDialog } from "./EditRequestDialog"

const Tactile3DViewer = dynamic(
  () => import("./Tactile3DViewer").then((module) => module.Tactile3DViewer),
  { ssr: false, loading: () => <p role="status" className="p-6 text-sm">Loading tactile preview…</p> }
)

export function ReviewWorkspace({ regions, onApprove, onReject, onEdit, onExport, approvingRegionId, rejectingRegionId, editingRegionId }: {
  regions: PersistedRegionItem[];
  onApprove: (regionId: string) => void;
  onReject: (regionId: string) => void;
  onEdit: (regionId: string, instruction: string) => Promise<boolean>;
  onExport: () => void;
  approvingRegionId: string | null;
  rejectingRegionId: string | null;
  editingRegionId: string | null;
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isOutlineOpen, setIsOutlineOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const index = Math.min(currentIndex, Math.max(0, regions.length - 1))
  const region = regions[index]
  const geometry = region?.geometry
  const issues = useMemo(() => geometry ? validateGeometry(geometry) : [], [geometry])
  if (!region) return <p className="p-6 text-sm">No regions are available for preview.</p>

  const data = region.extracted_data
  const generated = data?.kind === "diagram" && data.status === "processed" ? data.geometry_processing : undefined
  const hasGeometry = region.type === "diagram" && generated?.status === "validated" && !!region.geometry && issues.length === 0
  const canApprove = region.type === "diagram" ? hasGeometry : data?.status === "processed"
  const failure = data?.status === "failed" ? data.error.message
    : generated?.status === "failed" ? generated.error.message
    : issues.length ? "This geometry did not pass validation and cannot be previewed."
    : region.type === "diagram" && !hasGeometry ? "Validated tactile geometry is not available for this region." : null

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <div className="border-b border-neutral-200 pb-4">
        <p className="text-sm text-neutral-600">Document / Page {region.page_number} / Region {index + 1}</p>
        <h2 className="mt-1 text-xl font-semibold">Preview generated output</h2>
        <p className="mt-1 text-sm text-neutral-600">Compare the original source with the generated output. Approve or exclude each region independently, then export approved regions when you are ready.</p>
      </div>
      <RegionNavigator currentIndex={index} totalRegions={regions.length} currentRegion={region}
        onPrevious={() => setCurrentIndex(Math.max(0, index - 1))}
        onNext={() => setCurrentIndex(Math.min(regions.length - 1, index + 1))}
        onToggleSidebar={() => setIsOutlineOpen(!isOutlineOpen)} isSidebarOpen={isOutlineOpen} />
      <div className="flex flex-col items-start gap-6 xl:flex-row">
        {isOutlineOpen && <div className="w-full shrink-0 xl:w-52">
          <DocumentOutline regions={regions} currentRegionId={region.id}
            onSelectRegion={(id) => { const found = regions.findIndex((item) => item.id === id); if (found >= 0) setCurrentIndex(found) }}
            onClose={() => setIsOutlineOpen(false)} />
        </div>}
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 w-full">
          <section className="min-w-0 space-y-3" aria-label="Original source">
            <h3 className="text-sm font-semibold">Original source · Page {region.page_number}</h3>
            <SourcePreview key={region.id} region={region} />
          </section>
          <section className="min-w-0 space-y-3" aria-label="Generated output">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{region.type === "diagram" ? "Tactile preview" : "Braille preview"}</h3>
              {hasGeometry && <Badge variant="outline" className="text-emerald-800">Software checks passed</Badge>}
            </div>
            {failure ? <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">{failure}</div>
              : hasGeometry && region.geometry ? <>
                <Tactile3DViewer key={region.id} geometry={region.geometry} />
                <ValidationSummary warnings={data?.status === "processed" ? data.warnings : undefined} />
              </>
              : data?.kind === "table" ? <TablePreview data={data} />
              : data?.kind === "text" ? <BraillePreview data={data} />
              : <p className="p-6 text-sm">No processed output is available for this region.</p>}
          </section>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600" aria-live="polite">
          {regions.filter((item) => item.review_status === "approved").length} of {regions.length} regions approved
        </p>
        <div className="flex flex-wrap gap-2">
          {hasGeometry && <Button type="button" variant="outline" disabled={approvingRegionId !== null || rejectingRegionId !== null || editingRegionId !== null}
            onClick={() => setIsEditOpen(true)}>Request title edit</Button>}
          {regions.some((item) => item.review_status === "approved") &&
            <Button type="button" variant="outline" onClick={onExport}>Export approved regions</Button>}
          <Button type="button" variant="outline" disabled={region.review_status === "rejected" || approvingRegionId !== null || rejectingRegionId !== null}
            onClick={() => onReject(region.id)}>
            <X className="mr-2 size-4" />
            {rejectingRegionId === region.id ? "Saving exclusion…" : region.review_status === "rejected" ? "Region excluded" : "Exclude region"}
          </Button>
          <Button type="button" disabled={!canApprove || region.review_status === "approved" || approvingRegionId !== null || rejectingRegionId !== null}
            onClick={() => onApprove(region.id)}>
            <Check className="mr-2 size-4" />
            {approvingRegionId === region.id ? "Saving approval…" : region.review_status === "approved" ? "Region approved" : "Approve region"}
          </Button>
        </div>
      </div>
      <EditRequestDialog open={isEditOpen} onOpenChange={setIsEditOpen} region={region}
        onApplyEdit={(instruction) => onEdit(region.id, instruction)} />
    </div>
  )
}
