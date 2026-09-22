import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  className?: string
}

export function ErrorState({
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={`rounded-lg border border-red-200 bg-red-50/50 p-6 text-neutral-900 ${
        className ?? ""
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div className="rounded-md bg-red-100 p-2 text-red-700">
          <AlertTriangle className="size-5" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-red-950">{title}</h4>
          <p className="mt-1 text-sm text-neutral-700 leading-relaxed">
            {description}
          </p>

          {(onAction || onSecondaryAction) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {onAction && actionLabel && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={onAction}
                  className="bg-neutral-900 text-white hover:bg-neutral-800"
                >
                  <RotateCcw className="size-3.5 mr-1.5" />
                  {actionLabel}
                </Button>
              )}
              {onSecondaryAction && secondaryActionLabel && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSecondaryAction}
                  className="border-neutral-300 hover:bg-white"
                >
                  {secondaryActionLabel}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
