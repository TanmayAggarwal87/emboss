import React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WorkflowStep } from "@/lib/frontend-types"

const STEPS: { id: WorkflowStep; label: string; number: number }[] = [
  { id: "upload", label: "Upload", number: 1 },
  { id: "processing", label: "Processing", number: 2 },
  { id: "review", label: "Review", number: 3 },
  { id: "export", label: "Export", number: 4 },
]

export function WorkflowStepper({
  currentStep,
  onStepClick,
}: {
  currentStep: WorkflowStep
  onStepClick?: (step: WorkflowStep) => void
}) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep)
  const currentStepObj = STEPS[currentIndex] || STEPS[0]

  return (
    <div className="w-full border-b border-neutral-200 bg-neutral-50/70 py-2.5 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* Mobile View */}
        <div className="flex items-center justify-between sm:hidden text-xs">
          <span className="font-medium text-neutral-500">
            Step {currentStepObj.number} of 4
          </span>
          <span className="font-semibold text-neutral-900">
            {currentStepObj.label}
          </span>
        </div>

        {/* Desktop View */}
        <nav aria-label="Progress" className="hidden sm:flex items-center justify-center gap-8">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentIndex
            const isCurrent = index === currentIndex
            const isUpcoming = index > currentIndex

            return (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[11px] font-medium transition-colors",
                    isCompleted && "bg-neutral-900 text-white",
                    isCurrent && "border-2 border-neutral-900 text-neutral-900 bg-white font-semibold",
                    isUpcoming && "border border-neutral-300 text-neutral-400 bg-transparent"
                  )}
                >
                  {isCompleted ? <Check className="size-3 stroke-[2.5]" /> : step.number}
                </div>

                <span
                  className={cn(
                    "text-xs tracking-tight transition-colors",
                    isCompleted && "font-medium text-neutral-700",
                    isCurrent && "font-semibold text-neutral-900",
                    isUpcoming && "text-neutral-400"
                  )}
                >
                  {step.label}
                </span>

                {index < STEPS.length - 1 && (
                  <div className="ml-4 h-[1px] w-6 bg-neutral-200" />
                )}
              </div>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
