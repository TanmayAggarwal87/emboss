import * as THREE from "three"
import { buildGeometryMesh, disposeGeometryMesh } from "../tactile-geometry/mesh.ts"
import { validateGeometry } from "../tactile-geometry/validate.ts"
import type { GeometryState } from "../tactile-geometry/types.ts"

export interface PreviewMeshHandle {
  /** Returns the exact group handed to the renderer. Throws after disposal. */
  getMesh(): THREE.Group
  /** Releases the group's GPU resources. Safe to call more than once. */
  dispose(): void
}

/** Build the Phase 5 group once and retain its identity for preview/export. */
export function createPreviewMesh(geometry: GeometryState): PreviewMeshHandle {
  const issues = validateGeometry(geometry)
  if (issues.length > 0) {
    throw new Error(`Geometry validation failed: ${issues.map((issue) => issue.message).join("; ")}`)
  }

  const mesh = buildGeometryMesh(geometry)
  let disposed = false

  return {
    getMesh() {
      if (disposed) throw new Error("Preview mesh has been disposed")
      return mesh
    },
    dispose() {
      if (disposed) return
      disposed = true
      disposeGeometryMesh(mesh)
    },
  }
}
