import type { Object3D } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";

/** Serialize the complete mesh tree, including each child's world transform. */
export function serializeStl(object: Object3D): ArrayBuffer {
  object.updateMatrixWorld(true);
  const output = new STLExporter().parse(object, { binary: true });
  if (!(output instanceof DataView) || !(output.buffer instanceof ArrayBuffer)) {
    throw new Error("STL serialization did not produce binary output.");
  }
  return output.buffer;
}
