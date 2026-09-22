import assert from "node:assert/strict"
import test from "node:test"
import { createPreviewMesh } from "../../src/lib/preview/preview-mesh.ts"
import { generateGeometry } from "../../src/lib/tactile-geometry/generate.ts"
import { DEFAULT_PROFILE } from "../../src/lib/tactile-geometry/profile.ts"
import { EXPECTED_CHARTS } from "../diagram-extraction/fixtures.ts"
import * as THREE from "three"

test("preview handle preserves mesh identity and rejects access after disposal", () => {
  const handle = createPreviewMesh(generateGeometry(EXPECTED_CHARTS[0], DEFAULT_PROFILE, 1))
  const mesh = handle.getMesh()
  assert.strictEqual(handle.getMesh(), mesh)
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  mesh.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
    }
  })
  let released = 0
  for (const resource of [...geometries, ...materials]) resource.addEventListener("dispose", () => released++)
  handle.dispose()
  handle.dispose()
  assert.equal(released, geometries.size + materials.size)
  assert.throws(() => handle.getMesh(), /disposed/i)
})

test("invalid geometry is blocked before a preview mesh becomes available", () => {
  const geometry = generateGeometry(EXPECTED_CHARTS[0], DEFAULT_PROFILE, 1)
  geometry.plate.width = 1000
  assert.throws(() => createPreviewMesh(geometry), /validation failed/i)
})
