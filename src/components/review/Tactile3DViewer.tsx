"use client"

import React, { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { RotateCw, ZoomIn, ZoomOut, Eye, Maximize2, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip"
import { buildGeometryMesh, disposeGeometryMesh } from "@/lib/phase5/mesh"
import type { GeometryState } from "@/lib/phase5/types"

interface Tactile3DViewerProps {
  geometry: GeometryState
  className?: string
}

export function Tactile3DViewer({ geometry, className }: Tactile3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const meshGroupRef = useRef<THREE.Group | null>(null)

  const [isTopView, setIsTopView] = useState(false)
  const [wireframe, setWireframe] = useState(false)

  const plateWidth = geometry.plate.width
  const plateHeight = geometry.plate.height

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf8fafc) // Calm light neutral background
    sceneRef.current = scene

    // Camera setup
    const aspect = container.clientWidth / container.clientHeight
    const camera = new THREE.PerspectiveCamera(45, aspect, 1, 2000)
    cameraRef.current = camera

    // Initial camera position for natural tactile perspective
    const maxDim = Math.max(plateWidth, plateHeight, 150)
    camera.position.set(plateWidth / 2, -maxDim * 0.9, maxDim * 1.3)
    camera.up.set(0, 0, 1) // Z is UP for 3D printing plate
    camera.lookAt(plateWidth / 2, plateHeight / 2, 0)

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer

    container.replaceChildren(renderer.domElement)

    // Lighting for tactile relief clarity
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75)
    scene.add(ambientLight)

    // Key directional light creating tactile shadows on relief
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9)
    dirLight.position.set(plateWidth * 1.2, -plateHeight * 0.5, 200)
    scene.add(dirLight)

    const fillLight = new THREE.DirectionalLight(0xf0f4f8, 0.4)
    fillLight.position.set(-plateWidth * 0.5, plateHeight * 1.5, 150)
    scene.add(fillLight)

    // Build the official BANA-validated mesh group
    try {
      const meshGroup = buildGeometryMesh(geometry)
      meshGroupRef.current = meshGroup
      scene.add(meshGroup)
    } catch (err) {
      console.error("Error building tactile mesh:", err)
    }

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.target.set(plateWidth / 2, plateHeight / 2, geometry.plate.thickness / 2)
    controls.maxPolarAngle = Math.PI / 2 + 0.1 // Prevent going far below build plate
    controlsRef.current = controls

    // Render loop
    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Resize handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener("resize", handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener("resize", handleResize)
      controls.dispose()
      if (meshGroupRef.current) {
        disposeGeometryMesh(meshGroupRef.current)
      }
      renderer.dispose()
      container.replaceChildren()
    }
  }, [geometry, plateWidth, plateHeight])

  // Camera Actions
  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return
    const maxDim = Math.max(plateWidth, plateHeight, 150)
    cameraRef.current.position.set(plateWidth / 2, -maxDim * 0.9, maxDim * 1.3)
    controlsRef.current.target.set(plateWidth / 2, plateHeight / 2, geometry.plate.thickness / 2)
    controlsRef.current.update()
    setIsTopView(false)
  }

  const toggleTopView = () => {
    if (!cameraRef.current || !controlsRef.current) return
    if (!isTopView) {
      const maxDim = Math.max(plateWidth, plateHeight, 150)
      cameraRef.current.position.set(plateWidth / 2, plateHeight / 2, maxDim * 1.5)
      controlsRef.current.target.set(plateWidth / 2, plateHeight / 2, 0)
      controlsRef.current.update()
      setIsTopView(true)
    } else {
      resetCamera()
    }
  }

  const zoomIn = () => {
    if (!cameraRef.current || !controlsRef.current) return
    cameraRef.current.position.multiplyScalar(0.85)
    controlsRef.current.update()
  }

  const zoomOut = () => {
    if (!cameraRef.current || !controlsRef.current) return
    cameraRef.current.position.multiplyScalar(1.15)
    controlsRef.current.update()
  }

  const toggleWireframe = () => {
    if (!meshGroupRef.current) return
    const next = !wireframe
    setWireframe(next)
    meshGroupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => (m.wireframe = next))
        } else {
          child.material.wireframe = next
        }
      }
    })
  }

  return (
    <TooltipProvider>
      <div className={`relative flex flex-col rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden ${className ?? ""}`}>
        {/* 3D Canvas Viewport */}
        <div ref={containerRef} className="h-[380px] w-full cursor-grab active:cursor-grabbing select-none" />

        {/* Viewport Floating Controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 rounded-lg border border-neutral-200 bg-white/90 p-1 shadow-xs backdrop-blur-xs">
          <Tooltip content="Reset 3D view">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={resetCamera}
              className="size-7 text-neutral-600 hover:text-neutral-900"
            >
              <RotateCw className="size-3.5" />
            </Button>
          </Tooltip>

          <Tooltip content={isTopView ? "Isometric perspective" : "Top-down tactile view"}>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={toggleTopView}
              className={`size-7 ${isTopView ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:text-neutral-900"}`}
            >
              <Eye className="size-3.5" />
            </Button>
          </Tooltip>

          <Tooltip content="Zoom in">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={zoomIn}
              className="size-7 text-neutral-600 hover:text-neutral-900"
            >
              <ZoomIn className="size-3.5" />
            </Button>
          </Tooltip>

          <Tooltip content="Zoom out">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={zoomOut}
              className="size-7 text-neutral-600 hover:text-neutral-900"
            >
              <ZoomOut className="size-3.5" />
            </Button>
          </Tooltip>

          <Tooltip content="Toggle wireframe">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={toggleWireframe}
              className={`size-7 ${wireframe ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:text-neutral-900"}`}
            >
              <Layers className="size-3.5" />
            </Button>
          </Tooltip>
        </div>

        {/* Dimensions footer pill */}
        <div className="flex items-center justify-between border-t border-neutral-200 bg-white/80 px-3 py-1.5 text-[11px] text-neutral-500">
          <span>
            Plate: {Math.round(plateWidth)} × {Math.round(plateHeight)} mm ({geometry.plate.thickness}mm base)
          </span>
          <span className="text-neutral-400">
            Click & drag to rotate · Scroll to zoom
          </span>
        </div>
      </div>
    </TooltipProvider>
  )
}
