import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { parseArgs } from "node:util";
import { SupabaseJobRepository } from "../src/lib/document-processing/repository.ts";
import { getSupabaseAdmin } from "../src/lib/supabase/admin.ts";
import { EXPECTED_CHARTS } from "../tests/diagram-extraction/fixtures.ts";
import { buildGeometryMesh, disposeGeometryMesh } from "../src/lib/tactile-geometry/mesh.ts";
import { generateGeometry } from "../src/lib/tactile-geometry/generate.ts";
import { BRAILLE, DEFAULT_PROFILE } from "../src/lib/tactile-geometry/profile.ts";
import { validateGeometry } from "../src/lib/tactile-geometry/validate.ts";
import type { GeometryResult, GeometryState } from "../src/lib/tactile-geometry/types.ts";

const { values } = parseArgs({ options: {
  database: { type: "boolean", default: false },
  artifacts: { type: "boolean", default: false },
} });
if (existsSync(".env.local")) loadEnvFile(".env.local");

const originalFetch = globalThis.fetch;
const configuredOrigin = values.database && process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : undefined;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (configuredOrigin && url.origin === configuredOrigin) return originalFetch(input, { ...init, signal: AbortSignal.timeout(20_000) });
  throw new Error("Phase 5 diagnostic blocked a network request; Gemini is never used by this script. Use --database only with configured Supabase.");
};

let job: string | undefined;
try {
  const states = EXPECTED_CHARTS.map((chart) => generateGeometry(chart, DEFAULT_PROFILE, 1));
  for (const [index, state] of states.entries()) {
    const issues = validateGeometry(state);
    assert.deepEqual(issues, [], `chart ${index + 1} validation issues`);
    const mesh = buildGeometryMesh(state);
    disposeGeometryMesh(mesh);
    console.log(`PASS chart ${index + 1}: ${state.source.chart_type}; plate ${state.plate.width.toFixed(2)} × ${state.plate.height.toFixed(2)} × ${state.plate.thickness.toFixed(2)} mm; ${state.elements.length} elements.`);
  }
  const tooMany = { ...EXPECTED_CHARTS[0], data_points: Array.from({ length: 40 }, (_, i) => ({ label: `v${i}`, value: i + 1 })), independent_axis: { type: "categorical" as const, values: Array.from({ length: 40 }, (_, i) => `v${i}`) } };
  const failure = generateGeometrySafely(tooMany);
  assert.equal(failure.status, "failed", "40-bar chart must fail clearly rather than shrink below tactile minimums");
  if (failure.status === "failed") assert.equal(failure.error.code, "GEOMETRY_TOO_DENSE");
  console.log(`PASS dense failure: ${failure.status === "failed" ? failure.error.code : "unexpected validation"}.`);

  if (values.artifacts) {
    const folder = await mkdtemp(join(tmpdir(), "emboss-tactile-geometry-"));
    const { createDiagramFixture } = await import("../tests/diagram-extraction/fixtures.ts");
    await writeFile(join(folder, "fixture.pdf"), createDiagramFixture());
    for (const [index, state] of states.entries()) {
      await writeFile(join(folder, `chart-${index + 1}.json`), JSON.stringify(state, null, 2));
      await writeFile(join(folder, `chart-${index + 1}.svg`), svgAudit(state));
    }
    console.log(`Geometry audit artifacts: ${folder}`);
  }

  if (values.database) {
    if (!configuredOrigin || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("--database requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    const repository = new SupabaseJobRepository();
    job = await repository.createJob(2);
    const rows = states.map((geometry, index) => ({ region_id: `tactile-geometry-chart-${index + 1}`, type: "diagram" as const,
      bounding_box: { x: 40, y: 50, width: 920, height: 920 }, extracted_data: { kind: "diagram" as const, status: "processed" as const, source: "gemini" as const, data: EXPECTED_CHARTS[index], needs_data_review: false, warnings: [], geometry_processing: { status: "validated" as const } }, geometry }));
    await repository.insertRegions(job, 1, [rows[0]]);
    await repository.insertRegions(job, 2, [rows[1]]);
    await repository.markJobReady(job);
    const { data: jobRow, error: jobError } = await getSupabaseAdmin().from("jobs").select("status").eq("id", job).single();
    assert.equal(jobError, null);
    assert.equal(jobRow?.status, "ready_for_review");
    await repository.insertRegions(job, 1, [rows[0]]);
    await repository.insertRegions(job, 2, [rows[1]]);
    const { data, error } = await getSupabaseAdmin().from("regions").select("id, page_number, geometry, extracted_data").eq("job_id", job).order("page_number");
    assert.equal(error, null);
    assert.equal(data?.length, 2, "repeated insertion must not duplicate synthetic regions");
    for (const [index, row] of (data ?? []).entries()) {
      assert.equal(row.page_number, index + 1);
      assert.deepEqual(row.geometry, states[index]);
      assert.deepEqual(row.extracted_data, rows[index].extracted_data);
    }
    console.log("PASS Supabase: two synthetic geometry rows, exact readback, no duplicates.");
  }
  console.log("Phase 5 offline verification passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Phase 5 verification failed.");
  process.exitCode = 1;
} finally {
  try {
    if (job) {
      const { error } = await getSupabaseAdmin().from("jobs").delete().eq("id", job);
      if (error) throw new Error(`Cleanup failed; remove only synthetic diagnostic job ${job}.`);
      console.log("Removed this diagnostic's synthetic job and regions.");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : `Cleanup failed for synthetic job ${job}.`);
    process.exitCode = 1;
  } finally { globalThis.fetch = originalFetch; }
}

function generateGeometrySafely(input: Parameters<typeof generateGeometry>[0]): GeometryResult {
  try { return { status: "validated", geometry: generateGeometry(input, DEFAULT_PROFILE, 1), warnings: [] }; }
  catch (error) { return { status: "failed", error: { code: error instanceof Error && "code" in error ? String(error.code) : "GEOMETRY_GENERATION_FAILED", message: error instanceof Error ? error.message : "failed" } }; }
}

function svgAudit(state: GeometryState): string {
  const element = (e: GeometryState["elements"][number]) => {
    if (e.kind === "bar") {
      const body = `<rect id="${e.id}" x="${e.x}" y="${state.plate.height - e.y - e.height}" width="${e.width}" height="${e.height}" fill="#555"/>`;
      const count = e.orientation === "vertical"
        ? Math.max(0, Math.floor((e.height - 2 * state.profile.stripeInset - state.profile.stripeWidth) / state.profile.stripePitch) + 1)
        : Math.max(0, Math.floor((e.width - 2 * state.profile.stripeInset - state.profile.stripeWidth) / state.profile.stripePitch) + 1);
      const stripes = Array.from({ length: count }, (_, i) => e.orientation === "vertical"
        ? `<rect x="${e.x + state.profile.stripeInset}" y="${state.plate.height - e.y - state.profile.stripeInset - i * state.profile.stripePitch - state.profile.stripeWidth}" width="${Math.max(0, e.width - 2 * state.profile.stripeInset)}" height="${state.profile.stripeWidth}" fill="#bbb"/>`
        : `<rect x="${e.x + state.profile.stripeInset + i * state.profile.stripePitch}" y="${state.plate.height - e.y - e.height + state.profile.stripeInset}" width="${state.profile.stripeWidth}" height="${Math.max(0, e.height - 2 * state.profile.stripeInset)}" fill="#bbb"/>`).join("");
      return body + stripes;
    }
    if (e.kind === "point") return `<rect id="${e.id}" x="${e.x - e.size / 2}" y="${state.plate.height - e.y - e.size / 2}" width="${e.size}" height="${e.size}" fill="#555"/>`;
    if (e.kind === "line") return e.segments.map((s) => `<line id="${e.id}" x1="${s.from[0]}" y1="${state.plate.height - s.from[1]}" x2="${s.to[0]}" y2="${state.plate.height - s.to[1]}" stroke="#111" stroke-width="${e.width}"/>`).join("");
    const dots: string[] = [];
    e.braille.split("\n").forEach((line, lineIndex) => {
      let cell = 0;
      for (const character of line) {
        if (character === " " || character === "\u2800") { cell++; continue; }
        const bits = character.codePointAt(0)! - 0x2800;
        for (let dot = 0; dot < 6; dot++) if (bits & (1 << dot)) {
          const column = dot < 3 ? 0 : 1, row = dot < 3 ? dot : dot - 3;
          const cx = e.x + cell * BRAILLE.cellPitch + BRAILLE.dotDiameter / 2 + column * BRAILLE.dotPitch;
          const cy = e.y + e.height - BRAILLE.dotDiameter / 2 - lineIndex * BRAILLE.linePitch - row * BRAILLE.dotPitch;
          dots.push(`<circle id="${e.id}:dot:${lineIndex}:${cell}:${dot}" cx="${cx}" cy="${state.plate.height - cy}" r="${BRAILLE.dotDiameter / 2}"/>`);
        }
        cell++;
      }
    });
    return `<g id="${e.id}"><title>${escapeXml(e.text)}</title>${dots.join("")}</g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${state.plate.width} ${state.plate.height}"><rect width="100%" height="100%" fill="white"/>${state.elements.map(element).join("")}</svg>`;
}
function escapeXml(value: string): string { return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" }[character]!)); }
