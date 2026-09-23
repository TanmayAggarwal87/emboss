import assert from "node:assert/strict";
import test from "node:test";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { serializeStl } from "../../src/lib/export/stl.ts";
import { buildGeometryMesh, disposeGeometryMesh } from "../../src/lib/tactile-geometry/mesh.ts";
import { DEFAULT_PROFILE } from "../../src/lib/tactile-geometry/profile.ts";
import { generateGeometry } from "../../src/lib/tactile-geometry/generate.ts";
import { EXPECTED_CHARTS } from "../diagram-extraction/fixtures.ts";

test("serialized STL contains every raised child mesh above the base plate", () => {
  const state = generateGeometry(EXPECTED_CHARTS[0], { ...DEFAULT_PROFILE }, 1);
  const group = buildGeometryMesh(state);
  try {
    let meshCount = 0;
    group.traverse((object) => { if (object.type === "Mesh") meshCount += 1; });
    assert.ok(meshCount > 1, "preview geometry should contain the plate and multiple tactile meshes");

    const bytes = serializeStl(group);
    assert.ok(bytes instanceof ArrayBuffer);
    const exported = new STLLoader().parse(bytes);
    exported.computeBoundingBox();
    assert.ok(exported.boundingBox, "STL should have measurable bounds");
    assert.ok(Math.abs(exported.boundingBox.min.x) < 1e-4);
    assert.ok(Math.abs(exported.boundingBox.max.x - state.plate.width) < 1e-4);
    assert.ok(Math.abs(exported.boundingBox.min.y) < 1e-4);
    assert.ok(Math.abs(exported.boundingBox.max.y - state.plate.height) < 1e-4);
    assert.ok(exported.boundingBox.max.z > state.plate.thickness + 0.2,
      "STL must retain raised tactile features above the base plate");
    assert.ok(exported.getAttribute("position").count > 36,
      "STL should contain triangles for tactile child meshes, not only the plate");
  } finally {
    disposeGeometryMesh(group);
  }
});
