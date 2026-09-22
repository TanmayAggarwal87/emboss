"use client"

import { useEffect, useState } from "react"
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PersistedRegionItem } from "@/lib/frontend-types"

type ImageState = { status: "loading" } | { status: "ready"; url: string } | { status: "error"; message: string }

export function SourcePreview({ region, className }: { region: PersistedRegionItem; className?: string }) {
  const [zoom, setZoom] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [image, setImage] = useState<ImageState>({ status: "loading" })
  const sourceUrl = region.source_preview?.url
  const sourceError = region.source_preview?.error

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | undefined
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      setImage({ status: "loading" })
      setZoom(1)
      try {
        if (!sourceUrl) throw new Error(sourceError || "Source crop is not available for this region. Refer to your original PDF.")
        const url = new URL(sourceUrl, window.location.origin)
        if (url.origin !== window.location.origin) throw new Error("The source preview address is invalid.")
        const response = await fetch(url, { cache: "no-store", signal: controller.signal })
        if (response.status === 410) throw new Error("This temporary source crop has expired or is unavailable. Refer to your original PDF; generated results are still available.")
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png")) {
          throw new Error("The source crop could not be loaded. Try loading the crop again.")
        }
        const blob = await response.blob()
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setImage({ status: "ready", url: objectUrl })
      } catch (error) {
        if (!controller.signal.aborted) setImage({ status: "error", message: error instanceof Error ? error.message : "The source crop could not be loaded." })
      }
    })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [sourceUrl, sourceError, attempt])

  return (
    <div className={`relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 ${className ?? ""}`}>
      <div className="relative h-[380px] w-full overflow-auto bg-neutral-100/60 p-6">
        {image.status === "ready" ? (
          // Blob URLs are temporary and must bypass the persistent image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={`Source crop for page ${region.page_number}, ${region.type} region`}
            onError={() => setImage({ status: "error", message: "The source image could not be displayed. Try loading the crop again." })}
            style={{ width: `${zoom * 100}%`, maxWidth: "none" }} className="mx-auto h-auto"
          />
        ) : image.status === "loading" ? (
          <p role="status" className="p-6 text-center text-sm text-neutral-600">Loading source crop…</p>
        ) : (
          <div className="p-6 text-center text-sm text-neutral-600">
            <p role="alert">{image.message}</p>
            {sourceUrl && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setAttempt((value) => value + 1)}>Retry crop</Button>}
          </div>
        )}
      </div>
      <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-1">
        <Button type="button" aria-label="Zoom source in" disabled={image.status !== "ready"} variant="ghost" size="icon-sm" onClick={() => setZoom((value) => Math.min(value + .25, 2.5))}><ZoomIn className="size-4" /></Button>
        <Button type="button" aria-label="Reset source zoom" disabled={image.status !== "ready"} variant="ghost" size="icon-sm" onClick={() => setZoom(1)}><RotateCw className="size-4" /></Button>
        <Button type="button" aria-label="Zoom source out" disabled={image.status !== "ready"} variant="ghost" size="icon-sm" onClick={() => setZoom((value) => Math.max(value - .25, .5))}><ZoomOut className="size-4" /></Button>
      </div>
      <div className="flex justify-between border-t border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
        <span>Page {region.page_number} · Source crop</span><span>Zoom: {Math.round(zoom * 100)}%</span>
      </div>
    </div>
  )
}
