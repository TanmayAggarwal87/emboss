"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { Eye, RotateCw, ZoomIn, ZoomOut, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createPreviewMesh, type PreviewMeshHandle } from "@/lib/preview/preview-mesh"
import type { GeometryState } from "@/lib/tactile-geometry/types"

export interface Tactile3DViewerHandle { getMesh(): THREE.Group }
interface Props { geometry: GeometryState; className?: string }
type View = {
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  center: THREE.Vector3
  fitDistance: () => number
  render: () => void
}
const MIN_DISTANCE = 10
const MAX_DISTANCE = 5000

export const Tactile3DViewer = forwardRef<Tactile3DViewerHandle, Props>(function Tactile3DViewer({ geometry, className }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<View | null>(null)
  const previewRef = useRef<PreviewMeshHandle | null>(null)
  const [error, setError] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({
    getMesh() {
      if (!previewRef.current) throw new Error("Viewer is not ready")
      return previewRef.current.getMesh()
    },
  }), [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let renderer: THREE.WebGLRenderer | undefined
    let controls: OrbitControls | undefined
    let preview: PreviewMeshHandle | undefined
    let observer: ResizeObserver | undefined
    let disposed = false
    let contextLost = false
    const onContextLost = (event: Event) => {
      event.preventDefault()
      contextLost = true
      setError("The 3D preview lost its graphics context. Reload the page to try again.")
    }

    try {
      preview = createPreviewMesh(geometry)
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0xf8fafc)
      const width = Math.max(container.clientWidth, 1)
      const height = Math.max(container.clientHeight, 1)
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000)
      camera.up.set(0, 0, 1)
      const center = new THREE.Vector3(geometry.plate.width / 2, geometry.plate.height / 2, geometry.plate.thickness / 2)
      const radius = Math.hypot(geometry.plate.width, geometry.plate.height, geometry.plate.thickness) / 2
      const fitDistance = () => {
        const vertical = THREE.MathUtils.degToRad(camera.fov) / 2
        const horizontal = Math.atan(Math.tan(vertical) * camera.aspect)
        return radius / Math.sin(Math.min(vertical, horizontal)) * 1.15
      }
      camera.position.copy(center).add(new THREE.Vector3(0, -.6, .8).multiplyScalar(fitDistance()))
      camera.lookAt(center)

      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(width, height)
      renderer.domElement.setAttribute("aria-label", "Tactile diagram in three dimensions")
      container.replaceChildren(renderer.domElement)
      controls = new OrbitControls(camera, renderer.domElement)
      controls.target.copy(center)
      controls.enableDamping = false
      controls.minDistance = MIN_DISTANCE
      controls.maxDistance = MAX_DISTANCE
      controls.maxPolarAngle = Math.PI / 2 + .1

      scene.add(new THREE.AmbientLight(0xffffff, .75))
      const light = new THREE.DirectionalLight(0xffffff, 2)
      light.position.set(-geometry.plate.width, -geometry.plate.height, 100)
      scene.add(light)
      scene.add(preview.getMesh())
      const render = () => { if (!disposed && !contextLost) renderer?.render(scene, camera) }
      controls.addEventListener("change", render)
      renderer.domElement.addEventListener("webglcontextlost", onContextLost)
      viewRef.current = { camera, controls, center, fitDistance, render }
      previewRef.current = preview
      controls.update()
      render()
      observer = new ResizeObserver(() => {
        camera.aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1)
        camera.updateProjectionMatrix()
        renderer?.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1))
        render()
      })
      observer.observe(container)
      queueMicrotask(() => { if (!disposed) setError(null) })
    } catch {
      queueMicrotask(() => { if (!disposed) setError("The 3D preview could not be displayed. Check that your browser supports WebGL and hardware acceleration.") })
      controls?.dispose()
      preview?.dispose()
      renderer?.dispose()
      container.replaceChildren()
      viewRef.current = null
      previewRef.current = null
    }

    return () => {
      disposed = true
      observer?.disconnect()
      renderer?.domElement.removeEventListener("webglcontextlost", onContextLost)
      controls?.dispose()
      preview?.dispose()
      renderer?.dispose()
      viewRef.current = null
      previewRef.current = null
      container.replaceChildren()
    }
  }, [geometry])

  const reset = (top = false) => {
    const view = viewRef.current
    if (!view) return
    view.controls.target.copy(view.center)
    const direction = top ? new THREE.Vector3(0, -.0001, 1).normalize() : new THREE.Vector3(0, -.6, .8)
    view.camera.position.copy(view.center).add(direction.multiplyScalar(view.fitDistance()))
    view.controls.update()
    view.render()
  }
  const zoom = (factor: number) => {
    const view = viewRef.current
    if (!view) return
    const offset = view.camera.position.clone().sub(view.controls.target)
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, MIN_DISTANCE, MAX_DISTANCE))
    view.camera.position.copy(view.controls.target).add(offset)
    view.controls.update()
    view.render()
  }
  const orbit = (horizontal: number, vertical: number) => {
    const view = viewRef.current
    if (!view) return
    const toY = new THREE.Quaternion().setFromUnitVectors(view.camera.up, new THREE.Vector3(0, 1, 0))
    const offset = view.camera.position.clone().sub(view.controls.target).applyQuaternion(toY)
    const spherical = new THREE.Spherical().setFromVector3(offset)
    spherical.theta += horizontal * .15
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + vertical * .12, .08, Math.PI / 2 + .1)
    offset.setFromSpherical(spherical).applyQuaternion(toY.invert())
    view.camera.position.copy(view.controls.target).add(offset)
    view.controls.update()
    view.render()
  }
  const actions = [
    { label: "Reset 3D view", run: () => reset(), Icon: RotateCw },
    { label: "Top-down tactile view", run: () => reset(true), Icon: Eye },
    { label: "Zoom in", run: () => zoom(.85), Icon: ZoomIn },
    { label: "Zoom out", run: () => zoom(1.15), Icon: ZoomOut },
    { label: "Orbit left", run: () => orbit(-1, 0), Icon: ArrowLeft },
    { label: "Orbit right", run: () => orbit(1, 0), Icon: ArrowRight },
    { label: "Orbit up", run: () => orbit(0, -1), Icon: ArrowUp },
    { label: "Orbit down", run: () => orbit(0, 1), Icon: ArrowDown },
  ]

  return (
    <div className={`relative min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 ${className ?? ""}`}>
      <div ref={containerRef} className="h-[380px] w-full cursor-grab select-none active:cursor-grabbing" aria-label="Interactive tactile 3D preview" />
      {error && <div role="alert" className="absolute inset-x-0 top-0 flex h-[380px] items-center justify-center bg-white p-6 text-center text-sm text-red-800">{error}</div>}
      <div className="flex flex-wrap gap-1 border-t border-neutral-200 bg-white p-2" aria-label="3D camera controls">
        {actions.map(({ label, run, Icon }) => <Button key={label} type="button" variant="ghost" size="icon-sm" aria-label={label} title={label} disabled={!!error} onClick={run}><Icon className="size-4" /></Button>)}
      </div>
      <div className="space-y-1 border-t border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
        <p>Plate: {geometry.plate.width.toFixed(1)} × {geometry.plate.height.toFixed(1)} mm · {geometry.plate.thickness} mm base</p>
        <p>Drag to rotate · Scroll to zoom · Use the buttons with a keyboard</p>
      </div>
    </div>
  )
})
