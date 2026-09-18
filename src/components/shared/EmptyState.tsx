import React from "react"
import { LucideIcon, Inbox } from "lucide-react"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50 p-8 text-center ${
        className ?? ""
      }`}
    >
      <div className="rounded-full bg-neutral-100 p-3 text-neutral-500 mb-3">
        <Icon className="size-6" />
      </div>
      <h4 className="text-sm font-semibold text-neutral-900">{title}</h4>
      <p className="mt-1 max-w-sm text-xs text-neutral-500 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
