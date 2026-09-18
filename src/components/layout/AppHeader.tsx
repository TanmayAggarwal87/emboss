"use client"

import React, { useState } from "react"
import {
  Sparkles,
  Layers,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  FileCode,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

export function AppHeader({
  onReset,
}: {
  onReset?: () => void
}) {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)
  const [standardsOpen, setStandardsOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo & Name */}
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={onReset}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onReset?.()
            }}
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-neutral-900 text-white font-semibold shadow-xs">
              <span className="text-base tracking-tighter">⠃</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold tracking-tight text-neutral-900">
                  Emboss
                </span>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal text-neutral-500 border-neutral-200">
                  BANA 2022
                </Badge>
              </div>
              <p className="text-[11px] text-neutral-500 hidden sm:block">
                Accessible documents, made tactile
              </p>
            </div>
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHowItWorksOpen(true)}
              className="text-xs text-neutral-600 hover:text-neutral-900"
            >
              How it works
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStandardsOpen(true)}
              className="text-xs text-neutral-600 hover:text-neutral-900"
            >
              Standards
            </Button>
            <div className="h-4 w-[1px] bg-neutral-200 mx-1 hidden sm:block" />
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex"
            >
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 text-neutral-600 hover:text-neutral-900"
              >
                <span>GitHub</span>
                <ExternalLink className="size-3" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* "How It Works" Dialog */}
      <Dialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>How Emboss Works</DialogTitle>
            <DialogDescription>
              A linear pipeline turning visual educational documents into verified braille and tactile 3D models.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 text-sm text-neutral-700">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3.5">
              <div className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                  1
                </span>
                <div>
                  <h4 className="font-medium text-neutral-900">Analyse & Classify</h4>
                  <p className="mt-0.5 text-xs text-neutral-600 leading-relaxed">
                    MuPDF rasterizes the document while Gemini classifies regions as text, simple table, or supported diagram without guessing final coordinates.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3.5">
              <div className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                  2
                </span>
                <div>
                  <h4 className="font-medium text-neutral-900">Deterministic Conversion</h4>
                  <p className="mt-0.5 text-xs text-neutral-600 leading-relaxed">
                    Text is translated to Grade 2 UEB braille via liblouis. Diagrams are generated using mathematical three.js algorithms strictly conforming to BANA 2022 guidelines.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3.5">
              <div className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                  3
                </span>
                <div>
                  <h4 className="font-medium text-neutral-900">Human Verification & Export</h4>
                  <p className="mt-0.5 text-xs text-neutral-600 leading-relaxed">
                    Reviewers visually verify each region side-by-side with the original source before exporting an approved package with braille files and 3D STL tactile plates.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900 flex items-start gap-2.5">
              <ShieldCheck className="size-4 shrink-0 text-blue-600 mt-0.5" />
              <span>
                <strong>The Core Principle:</strong> AI interprets document data, but deterministic code calculates every millimeter and validates physical tolerances.
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* "Standards" Dialog */}
      <Dialog open={standardsOpen} onOpenChange={setStandardsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>BANA 2022 Tactile Graphics Standards</DialogTitle>
            <DialogDescription>
              Emboss strictly enforces physical tactile constraints for fingers to discern relief.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3 text-xs text-neutral-700">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-neutral-200 p-3 bg-neutral-50">
                <span className="font-semibold text-neutral-900 block mb-1">Minimum Spacing</span>
                <p className="text-neutral-600">
                  2.5 mm minimum separation between distinct tactile elements so fingertips do not perceive them as a single line.
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3 bg-neutral-50">
                <span className="font-semibold text-neutral-900 block mb-1">Braille Cell Scale</span>
                <p className="text-neutral-600">
                  Constant fixed dimensions (2.5mm dot pitch, 6.0mm cell pitch). Braille is never scaled with graphics.
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3 bg-neutral-50">
                <span className="font-semibold text-neutral-900 block mb-1">Elevation Hierarchy</span>
                <p className="text-neutral-600">
                  Data lines and bars have higher relief than axis lines, which are higher than reference grid lines.
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-3 bg-neutral-50">
                <span className="font-semibold text-neutral-900 block mb-1">Table Formatting</span>
                <p className="text-neutral-600">
                  Guide dots and 3-cell spacing replace visual grid borders, ensuring effortless braille line tracking.
                </p>
              </div>
            </div>

            <p className="text-[11px] text-neutral-500 pt-2">
              Based on the <em>Guidelines and Standards for Tactile Graphics (2022)</em> by the Braille Authority of North America (BANA) and the Canadian Braille Authority.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
