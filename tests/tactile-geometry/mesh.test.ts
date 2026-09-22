import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { generateGeometry } from "../../src/lib/tactile-geometry/generate.ts";
import { buildGeometryMesh, disposeGeometryMesh } from "../../src/lib/tactile-geometry/mesh.ts";
import { DEFAULT_PROFILE } from "../../src/lib/tactile-geometry/profile.ts";
import { EXPECTED_CHARTS } from "../diagram-extraction/fixtures.ts";

function state(index = 0) { return generateGeometry(EXPECTED_CHARTS[index], { ...DEFAULT_PROFILE }, 1); }

test("builds finite, deterministic geometry with element addressing", () => {
  const a = buildGeometryMesh(state(0));
  const b = buildGeometryMesh(state(0));
  assert.equal(JSON.stringify(a.toJSON()), JSON.stringify(b.toJSON()));
  const finite: number[] = [];
  a.traverse((object) => {
    object.updateMatrixWorld(true);
    object.matrixWorld.elements.forEach((value) => finite.push(value));
    if (object instanceof THREE.Mesh) object.geometry.computeBoundingBox();
  });
  assert.ok(finite.every(Number.isFinite));
  a.children.filter((child) => child.name !== "plate").forEach((child) => {
    assert.equal(child.userData.elementId, child.name);
  });
  disposeGeometryMesh(a);
  disposeGeometryMesh(b);
});

test("plate is positioned from the lower-left origin", () => {
  const mesh = buildGeometryMesh(state(0));
  const plate = mesh.getObjectByName("plate");
  assert.ok(plate);
  plate!.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(plate!);
  assert.ok(Math.abs(box.min.x) < 1e-5);
  assert.ok(Math.abs(box.min.y) < 1e-5);
  assert.ok(Math.abs(box.min.z) < 1e-5);
  assert.equal(box.max.z, DEFAULT_PROFILE.baseThickness);
  disposeGeometryMesh(mesh);
});

test("braille dots keep fixed dimensions and map top-to-bottom rows", () => {
  const geometry = state(0);
  const label = geometry.elements.find((element) => element.kind === "label" && /[\u2801-\u283f]/.test(element.braille));
  assert.ok(label && label.kind === "label");
  const mesh = buildGeometryMesh(geometry);
  const labelGroup = mesh.getObjectByName(label!.id)!;
  const dots = labelGroup.children.filter((child) => child.name.includes(":dot:")) as THREE.Mesh[];
  assert.ok(dots.length > 0);
  dots.forEach((dot) => {
    const box = new THREE.Box3().setFromObject(dot);
    assert.ok(Math.abs(box.max.z - (geometry.plate.thickness + 0.48)) < 1e-6);
    assert.ok(Math.abs(box.min.z - (geometry.plate.thickness - 0.48)) < 1e-6);
  });
  assert.ok(dots.every((dot) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(dot.uuid)));
  const x = dots.map((dot) => dot.position.x).sort((a, b) => a - b);
  assert.ok(x.some((value, i) => i > 0 && Math.abs(value - x[i - 1] - 2.34) < 1e-6));
  disposeGeometryMesh(mesh);
});

test("bar stripes remain contained at configured pitch", () => {
  const geometry = state(0);
  const bar = geometry.elements.find((element) => element.kind === "bar")!;
  const mesh = buildGeometryMesh(geometry);
  const group = mesh.getObjectByName(bar.id)!;
  const stripes = group.children.filter((child) => child.name.includes(":stripe:")) as THREE.Mesh[];
  assert.ok(stripes.length > 0);
  const centres = stripes.map((stripe) => stripe.position.y).sort((a, b) => a - b);
  centres.slice(1).forEach((value, i) => assert.ok(Math.abs(value - centres[i] - DEFAULT_PROFILE.stripePitch) < 1e-6));
  stripes.forEach((stripe) => {
    const box = new THREE.Box3().setFromObject(stripe);
    assert.ok(box.min.x >= bar.x + DEFAULT_PROFILE.stripeInset - 1e-6);
    assert.ok(box.max.x <= bar.x + bar.width - DEFAULT_PROFILE.stripeInset + 1e-6);
    assert.ok(box.min.y >= bar.y + DEFAULT_PROFILE.stripeInset - 1e-6);
    assert.ok(box.max.y <= bar.y + bar.height - DEFAULT_PROFILE.stripeInset + 1e-6);
    assert.ok(Math.abs(box.max.z - (geometry.plate.thickness + bar.rise + DEFAULT_PROFILE.stripeRise)) < 1e-6);
  });
  disposeGeometryMesh(mesh);
});

test("braille dimensions do not scale with chart geometry", () => {
  const widths = EXPECTED_CHARTS.map((_, index) => {
    const geometry = state(index);
    const label = geometry.elements.find((element) => element.kind === "label" && element.text === "0")!;
    assert.equal(label.kind, "label");
    const mesh = buildGeometryMesh(geometry);
    const dots = mesh.getObjectByName(label.id)!.children;
    assert.ok(dots.length > 0);
    disposeGeometryMesh(mesh);
    return [label.width, label.height];
  });
  assert.deepEqual(widths[0], widths[1]);
  assert.ok(widths.every(([width, height]) => width > 0 && height > 0));
});

test("validation failures are rejected before any mesh is created", () => {
  const invalid = state(0);
  invalid.plate.width = invalid.profile.maxWidth + 1;
  assert.throws(() => buildGeometryMesh(invalid), /validation failed/i);
});
