"use client"

import React, { useState } from "react"
import {
  CheckCircle2,
  Download,
  ShieldCheck,
  FileText,
  Table2,
  Box,
  RotateCcw,
  Loader2,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import JSZip from "jszip"
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js"
import { buildGeometryMesh, disposeGeometryMesh } from "@/lib/tactile-geometry/mesh"
import type { PersistedRegionItem } from "@/lib/frontend-types"

interface ExportViewProps {
  fileName: string
  regions: PersistedRegionItem[]
  onReset: () => void
  onBack: () => void
}

export function ExportView({ fileName, regions, onReset, onBack }: ExportViewProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const approvedRegions = regions.filter((r) => r.review_status === "approved")
  const rejectedRegions = regions.filter((r) => r.review_status === "rejected")
  const unsupportedRegions = regions.filter(
    (r) =>
      r.extracted_data?.status === "failed" ||
      (r.type === "diagram" && !r.geometry)
  )

  const textCount = approvedRegions.filter((r) => r.type === "text").length
  const tableCount = approvedRegions.filter((r) => r.type === "table").length
  const diagramCount = approvedRegions.filter(
    (r) => r.type === "diagram" && r.geometry
  ).length

  const handleDownload = async () => {
    setIsExporting(true)
    try {
      const zip = new JSZip()
      const exporter = new STLExporter()
      const baseName = fileName.replace(/\.pdf$/i, "")

      // 1. Text Regions Braille Files
      let combinedBrailleText = ""
      approvedRegions
        .filter((r) => r.type === "text" && r.extracted_data?.kind === "text" && r.extracted_data.status === "processed")
        .forEach((r, i) => {
          if (r.extracted_data?.kind !== "text" || r.extracted_data.status !== "processed") return
          const content = r.extracted_data.braille
          zip.file(`text_page_${r.page_number}_region_${i + 1}.brf`, content)
          combinedBrailleText += `--- Page ${r.page_number} ---\n\n${content}\n\n`
        })

      if (combinedBrailleText) {
        zip.file(`${baseName}_complete_braille.brf`, combinedBrailleText)
      }

      // 2. Table Regions Braille Files
      approvedRegions
        .filter((r) => r.type === "table" && r.extracted_data?.kind === "table" && r.extracted_data.status === "processed")
        .forEach((r, i) => {
          if (r.extracted_data?.kind !== "table" || r.extracted_data.status !== "processed") return
          const content = r.extracted_data.braille_pages.join("\n\n---\n\n")
          zip.file(`table_page_${r.page_number}_region_${i + 1}.brf`, content)
        })

      // 3. Tactile 3D STL Files generated from the exact three.js mesh objects
      for (let i = 0; i < approvedRegions.length; i++) {
        const r = approvedRegions[i]
        if (r.type === "diagram" && r.geometry) {
          const meshGroup = buildGeometryMesh(r.geometry)
          try {
            const stlOutput = exporter.parse(meshGroup, { binary: true })
            zip.file(`tactile_graphic_page_${r.page_number}_diagram_${i + 1}.stl`, stlOutput.buffer)
          } finally {
            disposeGeometryMesh(meshGroup)
          }
        }
      }

      // 4. Manifest / Readme
      const manifest = `EMBOSS ACCESSIBLE EXPORT PACKAGE
Source Document: ${fileName}
Generated: ${new Date().toISOString()}
Standards: BANA 2022 Guidelines and Standards for Tactile Graphics

CONTENTS:
- Approved Text Regions: ${textCount}
- Approved Table Regions: ${tableCount}
- Approved Tactile 3D Diagrams: ${diagramCount}
- Excluded / Rejected Regions: ${rejectedRegions.length}

Tactile STL files can be directly sliced in standard FDM slicers (PrusaSlicer, Bambu Studio, Cura) at 0.15mm layer height or embossed.
`
      zip.file("README_EMBOSS.txt", manifest)

      // Generate Zip blob
      const zipBlob = await zip.generateAsync({ type: "blob" })

      // Trigger client download
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${baseName}_accessible_package.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export generation failed", error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadRegion = async (region: PersistedRegionItem, index: number) => {
    setDownloadError(null)
    try {
      let blob: Blob
      let extension: "brf" | "stl"
      if (region.type === "text" && region.extracted_data?.kind === "text" && region.extracted_data.status === "processed") {
        blob = new Blob([region.extracted_data.braille], { type: "text/plain;charset=utf-8" })
        extension = "brf"
      } else if (region.type === "table" && region.extracted_data?.kind === "table" && region.extracted_data.status === "processed") {
        blob = new Blob([region.extracted_data.braille_pages.join("\n\n---\n\n")], { type: "text/plain;charset=utf-8" })
        extension = "brf"
      } else if (region.type === "diagram" && region.geometry) {
        const mesh = buildGeometryMesh(region.geometry)
        try {
          const output = new STLExporter().parse(mesh, { binary: true })
          blob = new Blob([output.buffer as ArrayBuffer], { type: "model/stl" })
        } finally {
          disposeGeometryMesh(mesh)
        }
        extension = "stl"
      } else {
        setDownloadError("This approved region has no exportable file.")
        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${fileName.replace(/\.pdf$/i, "")}_page_${region.page_number}_region_${index + 1}.${extension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Region export failed", error)
      setDownloadError("This region could not be exported. Please try again.")
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Top Completion Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mb-1">
          <CheckCircle2 className="size-6 stroke-[2.5]" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
          Your accessible document is ready
        </h2>
        <p className="text-xs text-neutral-500 max-w-md mx-auto">
          Each approved region is available as an individual file, and you can also download them together as a package.
        </p>
      </div>

      {/* Export Summary Card */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs space-y-6">
        <div>
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
            Source Document
          </span>
          <h3 className="text-sm font-semibold text-neutral-900">{fileName}</h3>
        </div>

        {/* Review Breakdown Pills */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800 font-medium">
            {approvedRegions.length} approved
          </span>
          <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-neutral-600">
            {rejectedRegions.length} excluded
          </span>
          {unsupportedRegions.length > 0 && (
            <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-neutral-500">
              {unsupportedRegions.length} unsupported
            </span>
          )}
        </div>

        {/* Package Contents Breakdown */}
        <div className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-4 space-y-2.5">
          <h4 className="text-xs font-semibold text-neutral-700">Package contents:</h4>
          <div className="space-y-1.5 text-xs text-neutral-600">
            <div className="flex items-center gap-2">
              <FileText className="size-3.5 text-neutral-500" />
              <span>{textCount} Grade 2 UEB braille document files</span>
            </div>
            <div className="flex items-center gap-2">
              <Table2 className="size-3.5 text-neutral-500" />
              <span>{tableCount} BANA standard braille table files</span>
            </div>
            <div className="flex items-center gap-2">
              <Box className="size-3.5 text-neutral-500" />
              <span>{diagramCount} 3D-printable tactile STL relief graphic files</span>
            </div>
          </div>
        </div>

        {approvedRegions.length > 0 && <div className="space-y-2">
          <h4 className="text-xs font-semibold text-neutral-700">Approved region files</h4>
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {approvedRegions.map((region, index) => <li key={region.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <span className="text-xs text-neutral-700">Page {region.page_number} · Region {index + 1} · {region.type}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => void handleDownloadRegion(region, index)}>
                <Download className="mr-1.5 size-3.5" /> Download file
              </Button>
            </li>)}
          </ul>
          {downloadError && <p role="alert" className="text-xs text-red-700">{downloadError}</p>}
        </div>}

        {/* Download Action */}
        <div className="space-y-2 pt-2">
          <Button
            type="button"
            size="lg"
            onClick={handleDownload}
            disabled={isExporting || approvedRegions.length === 0}
            className="w-full bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-medium gap-2 h-10 shadow-xs"
          >
            {isExporting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Assembling package…</span>
              </>
            ) : (
              <>
                <Download className="size-4" />
                <span>Download export package (.zip)</span>
              </>
            )}
          </Button>
          <p className="text-center text-[11px] text-neutral-400">
            Only approved regions are included in the download package.
          </p>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-4 flex items-start gap-3 text-xs text-neutral-600">
        <ShieldCheck className="size-5 shrink-0 text-neutral-800 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-neutral-900 block">
            Your document isn&apos;t stored permanently
          </span>
          <p className="text-[11px] leading-relaxed text-neutral-500">
            Emboss keeps this job only for the current workflow session. There is no account history, persistent document library, or external file storage bucket.
          </p>
        </div>
      </div>

      {/* Reset / New Document */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onBack} className="text-xs gap-1.5">
          <ArrowLeft className="size-3.5" />
          <span>Back to region review</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-xs text-neutral-600 hover:text-neutral-900 gap-1.5"
        >
          <RotateCcw className="size-3.5" />
          <span>Process another document</span>
        </Button>
      </div>
    </div>
  )
}
