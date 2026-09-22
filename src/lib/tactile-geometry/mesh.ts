import * as THREE from "three";
import { BRAILLE } from "./profile.ts";
import { brailleSize } from "./measure.ts";
import { validateGeometry } from "./validate.ts";
import type { GeometryElement, GeometryState, Segment } from "./types.ts";

/** Build the one mesh tree used by both the preview and eventual exporter. */
export function buildGeometryMesh(state: GeometryState): THREE.Group {
  const issues = validateGeometry(state);
  if (issues.length) {
    const error = new Error(`Geometry validation failed: ${issues.map((i) => i.message).join("; ")}`);
    (error as Error & { issues?: typeof issues }).issues = issues;
    throw error;
  }

  const root = namedGroup("geometry", "geometry");
  const material = new THREE.MeshStandardMaterial({ color: 0x8b8f94, roughness: 0.8, metalness: 0 });
  deterministicUuid(material, "material:relief");

  const plate = namedGroup("plate", "plate");
  const plateGeometry = new THREE.BoxGeometry(state.plate.width, state.plate.height, state.plate.thickness);
  deterministicUuid(plateGeometry, "plate:geometry");
  const plateMesh = new THREE.Mesh(plateGeometry, material);
  deterministicUuid(plateMesh, "plate:mesh");
  plateMesh.position.set(state.plate.width / 2, state.plate.height / 2, state.plate.thickness / 2);
  plate.add(plateMesh);
  root.add(plate);

  state.elements.forEach((element) => root.add(buildElement(element, state, material)));
  return root;
}

function buildElement(element: GeometryElement, state: GeometryState, material: THREE.Material): THREE.Group {
  const group = namedGroup(element.id, element.id);
  group.userData.elementId = element.id;
  if (element.kind === "bar") {
    const bodyHeight = element.rise + state.profile.embedDepth;
    addBox(group, `${element.id}:body`, element.width, element.height, bodyHeight,
      element.x + element.width / 2, element.y + element.height / 2,
      state.plate.thickness - state.profile.embedDepth + bodyHeight / 2, material, element.id);
    const stripeWidth = state.profile.stripeWidth;
    const inset = state.profile.stripeInset;
    if (element.orientation === "vertical") {
      for (let offset = inset, index = 0; offset + stripeWidth <= element.height - inset + 1e-9; offset += state.profile.stripePitch, index++) {
        addBox(group, `${element.id}:stripe:${index}`, Math.max(0, element.width - 2 * inset), stripeWidth,
          state.profile.stripeRise + state.profile.embedDepth,
          element.x + element.width / 2, element.y + offset + stripeWidth / 2,
          state.plate.thickness + element.rise - state.profile.embedDepth +
            (state.profile.stripeRise + state.profile.embedDepth) / 2,
          material, element.id);
      }
    } else {
      for (let offset = inset, index = 0; offset + stripeWidth <= element.width - inset + 1e-9; offset += state.profile.stripePitch, index++) {
        addBox(group, `${element.id}:stripe:${index}`, stripeWidth, Math.max(0, element.height - 2 * inset),
          state.profile.stripeRise + state.profile.embedDepth,
          element.x + offset + stripeWidth / 2, element.y + element.height / 2,
          state.plate.thickness + element.rise - state.profile.embedDepth +
            (state.profile.stripeRise + state.profile.embedDepth) / 2,
          material, element.id);
      }
    }
  } else if (element.kind === "point") {
    const h = element.rise + state.profile.embedDepth;
    addBox(group, `${element.id}:body`, element.size, element.size, h, element.x, element.y,
      state.plate.thickness - state.profile.embedDepth + h / 2, material, element.id);
  } else if (element.kind === "line") {
    element.segments.forEach((segment, index) => addSegment(group, `${element.id}:segment:${index}`, segment,
      element.width, element.rise, state, material, element.id));
  } else {
    addLabel(group, element, state, material);
  }
  return group;
}

function addBox(group: THREE.Group, id: string, width: number, height: number, depth: number,
  x: number, y: number, z: number, material: THREE.Material, parentElementId: string): void {
  if (!(width > 0 && height > 0 && depth > 0)) return;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  deterministicUuid(geometry, `${id}:geometry`);
  const mesh = new THREE.Mesh(geometry, material);
  deterministicUuid(mesh, `${id}:mesh`);
  mesh.name = id;
  mesh.userData.parentElementId = parentElementId;
  mesh.position.set(x, y, z);
  group.add(mesh);
}

function addSegment(group: THREE.Group, id: string, segment: Segment, width: number, rise: number,
  state: GeometryState, material: THREE.Material, parentElementId: string): void {
  const dx = segment.to[0] - segment.from[0], dy = segment.to[1] - segment.from[1];
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return;
  const depth = rise + state.profile.embedDepth;
  const geometry = new THREE.BoxGeometry(length, width, depth);
  deterministicUuid(geometry, `${id}:geometry`);
  const mesh = new THREE.Mesh(geometry, material);
  deterministicUuid(mesh, `${id}:mesh`);
  mesh.name = id;
  mesh.userData.parentElementId = parentElementId;
  mesh.position.set((segment.from[0] + segment.to[0]) / 2, (segment.from[1] + segment.to[1]) / 2,
    state.plate.thickness - state.profile.embedDepth + depth / 2);
  mesh.rotation.z = Math.atan2(dy, dx);
  group.add(mesh);
}

function addLabel(group: THREE.Group, label: Extract<GeometryElement, { kind: "label" }>, state: GeometryState, material: THREE.Material): void {
  const lines = label.braille.split("\n");
  const measured = brailleSize(label.braille);
  const height = label.height || measured.height;
  lines.forEach((line, lineIndex) => {
    let cell = 0;
    for (const character of line) {
      if (character === " " || character === "\u2800") { cell++; continue; }
      const bits = character.codePointAt(0)! - 0x2800;
      for (let dot = 0; dot < 6; dot++) {
        if (!(bits & (1 << dot))) continue;
        const column = dot < 3 ? 0 : 1;
        const row = dot < 3 ? dot : dot - 3;
        const cx = label.x + cell * BRAILLE.cellPitch + BRAILLE.dotDiameter / 2 + column * BRAILLE.dotPitch;
        const cy = label.y + height - BRAILLE.dotDiameter / 2 - lineIndex * BRAILLE.linePitch - row * BRAILLE.dotPitch;
        const geometry = new THREE.SphereGeometry(1, 12, 8);
        geometry.scale(BRAILLE.dotDiameter / 2, BRAILLE.dotDiameter / 2, BRAILLE.dotHeight);
        deterministicUuid(geometry, `${label.id}:dot:${lineIndex}:${cell}:${dot}:geometry`);
        const mesh = new THREE.Mesh(geometry, material);
        deterministicUuid(mesh, `${label.id}:dot:${lineIndex}:${cell}:${dot}:mesh`);
        mesh.name = `${label.id}:dot:${lineIndex}:${cell}:${dot}`;
        mesh.userData.parentElementId = label.id;
        mesh.position.set(cx, cy, state.plate.thickness);
        group.add(mesh);
      }
      cell++;
    }
  });
}

function namedGroup(name: string, id: string): THREE.Group {
  const group = new THREE.Group(); group.name = name; deterministicUuid(group, `group:${id}`); return group;
}

function deterministicUuid(object: { uuid: string }, seed: string): void {
  let h1 = 0x811c9dc5, h2 = 0x01000193, h3 = 0x9e3779b9, h4 = 0x85ebca6b;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193); h2 = Math.imul(h2 ^ c, 0x85ebca6b);
    h3 = Math.imul(h3 ^ c, 0xc2b2ae35); h4 = Math.imul(h4 ^ c, 0x27d4eb2f);
  }
  let hex = [h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, "0")).join("");
  hex = `${hex.slice(0, 12)}4${hex.slice(13, 16)}${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0")}${hex.slice(18)}`;
  object.uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function disposeGeometryMesh(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
  group.traverse((object) => { const mesh = object as THREE.Mesh; if (mesh.geometry) geometries.add(mesh.geometry); if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => materials.add(m)); });
  geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
}
