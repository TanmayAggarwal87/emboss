/**
 * Phase 6 browser smoke test.
 *
 * Uses Chrome's native DevTools Protocol directly:
 * - Never starts Playwright.
 * - Never permits requests to Gemini or Supabase origins.
 * - Verifies upload-to-review flow, real source image rendering, camera controls,
 *   region navigation, expired source-crop handling, blocking of invalid geometry,
 *   WebGL context loss handling, and desktop/mobile layouts.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import { openPdf } from "../src/lib/document-processing/pdf.ts";
import type { SupportedDiagramData } from "../src/lib/diagram-extraction/schema.ts";

interface CdpEvaluateResult {
  result?: {
    type?: string;
    value?: unknown;
  };
  exceptionDetails?: {
    text?: string;
    exception?: { description?: string };
  };
}

interface CdpCaptureScreenshotResult {
  data: string;
}

interface CdpGetDocumentResult {
  root: {
    nodeId: number;
  };
}

interface CdpQuerySelectorResult {
  nodeId: number;
}

interface CdpRequestPausedParams {
  requestId: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
  };
}

interface CdpMessage {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { code: number; message: string; data?: unknown };
}

interface CdpClient {
  send<T = Record<string, unknown>>(method: string, params?: Record<string, unknown>): Promise<T>;
  close(): void;
  onEvent(handler: (message: CdpMessage) => void): void;
}

const base =
  process.argv.slice(2).find((x) => x.startsWith("--url="))?.slice(6) ||
  process.env.TEST_BASE_URL ||
  "http://localhost:3100";

const artifactDir = await mkdtemp(join(tmpdir(), "emboss-preview-browser-"));
const sourceImages = new Map<string, Uint8Array>();
const requestedUrls: string[] = [];
let sourceExpiryUrl = "";

function cdpConnect(url: string): CdpClient {
  const socket = new WebSocket(url);
  let seq = 0;
  const pending = new Map<number, { resolve: (x: unknown) => void; reject: (x: Error) => void }>();
  const listeners: Array<(message: CdpMessage) => void> = [];

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as CdpMessage;
    if (message.id !== undefined) {
      const p = pending.get(message.id);
      if (!p) return;
      pending.delete(message.id);
      if (message.error) {
        p.reject(new Error(JSON.stringify(message.error)));
      } else {
        p.resolve(message.result ?? {});
      }
    } else {
      for (const listener of listeners) {
        listener(message);
      }
    }
  });

  const ready = new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve());
    socket.addEventListener("error", () => reject(new Error("Chrome CDP socket failed")));
  });

  return {
    send: async <T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}): Promise<T> => {
      await ready;
      const id = ++seq;
      return await new Promise<T>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (x: unknown) => void, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => socket.close(),
    onEvent: (handler) => listeners.push(handler),
  };
}

async function evaluate<T = unknown>(cdp: CdpClient, expression: string, awaitPromise = true): Promise<T> {
  const r = await cdp.send<CdpEvaluateResult>("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    throw new Error(String(r.exceptionDetails.text || r.exceptionDetails.exception?.description || "browser evaluation failed"));
  }
  return r.result?.value as T;
}

async function waitFor(cdp: CdpClient, expression: string, timeout = 30_000): Promise<boolean> {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await evaluate<boolean>(cdp, expression)) return true;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

function findChrome(): string {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && join(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Microsoft/Edge/Application/msedge.exe"),
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
    process.env["PROGRAMFILES(X86)"] && join(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
  ].filter((x): x is string => Boolean(x));

  const found = candidates.find(existsSync);
  if (!found) throw new Error("Chrome/Edge not found; set CHROME_PATH to a Chromium executable.");
  return found;
}

async function launchBrowser(): Promise<{ process: ChildProcess; cdp: CdpClient; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), "emboss-chrome-"));
  const executable = findChrome();
  const child = spawn(
    executable,
    [
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
      "--remote-debugging-port=0",
      `--user-data-dir=${dir}`,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" }
  );

  const active = join(dir, "DevToolsActivePort");
  let port = "";
  for (let i = 0; i < 80; i++) {
    try {
      port = (await readFile(active, "utf8")).split(/\s+/)[0];
      if (port) break;
    } catch {
      await delay(100);
    }
  }

  if (!port) {
    child.kill();
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    throw new Error("Chrome did not publish DevToolsActivePort within 8 seconds.");
  }

  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  const tabs = (await response.json()) as Array<{ webSocketDebuggerUrl?: string; type?: string }>;
  const tab = tabs.find((t) => t.type === "page" && t.webSocketDebuggerUrl) || tabs.find((t) => t.webSocketDebuggerUrl);

  if (!tab?.webSocketDebuggerUrl) {
    child.kill();
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    throw new Error("Chrome exposed no debuggable page target.");
  }

  return { process: child, cdp: cdpConnect(tab.webSocketDebuggerUrl), dir };
}

async function terminateProcessSafely(child: ChildProcess): Promise<void> {
  if (child.killed) return;
  try {
    child.kill("SIGTERM");
  } catch {
    // ignore
  }
  const exited = new Promise<void>((resolve) => {
    child.on("exit", () => resolve());
    child.on("close", () => resolve());
  });
  const timeout = delay(3000);
  await Promise.race([exited, timeout]);
  if (!child.killed) {
    try {
      child.kill("SIGKILL");
    } catch {
      // ignore
    }
  }
}

async function isServerRunning(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function ensureServerRunning(url: string): Promise<ChildProcess | undefined> {
  if (await isServerRunning(url)) {
    return undefined;
  }
  const parsed = new URL(url);
  const port = parsed.port || "3000";
  const server = spawn(
    process.execPath,
    ["./node_modules/next/dist/bin/next", "start", "-p", port, "-H", "127.0.0.1"],
    { windowsHide: true, stdio: "ignore" }
  );

  const start = Date.now();
  while (Date.now() - start < 15_000) {
    if (await isServerRunning(url)) {
      return server;
    }
    await delay(300);
  }
  await terminateProcessSafely(server);
  throw new Error(`Next.js server failed to start at ${url} within 15 seconds.`);
}

async function fixtureResponse(): Promise<Record<string, unknown>> {
  try {
    const fixtures = await import("../tests/diagram-extraction/fixtures.ts");
    const { generateGeometry } = await import("../src/lib/tactile-geometry/generate.ts");
    const { DEFAULT_PROFILE } = await import("../src/lib/tactile-geometry/profile.ts");
    const charts = fixtures.EXPECTED_CHARTS as SupportedDiagramData[];
    const pdfBytes = fixtures.createDiagramFixture();
    const document = openPdf(pdfBytes);
    const jobId = randomUUID();

    const validRegions = charts.slice(0, 2).map((data, i) => {
      const id = randomUUID();
      sourceImages.set(id, document.rasterizeRegion(i, fixtures.CHART_BOX));
      if (i === 0) sourceExpiryUrl = `/api/jobs/${jobId}/regions/${id}/source?expired=1`;
      return {
        id,
        job_id: jobId,
        page_number: i + 1,
        type: "diagram" as const,
        bounding_box: fixtures.CHART_BOX,
        review_status: "pending" as const,
        extracted_data: {
          kind: "diagram" as const,
          status: "processed" as const,
          source: "gemini" as const,
          data,
          needs_data_review: false,
          warnings: [],
          geometry_processing: { status: "validated" as const },
        },
        geometry: generateGeometry(data, DEFAULT_PROFILE, 1),
        source_preview: { url: `/api/jobs/${jobId}/regions/${id}/source` },
      };
    });

    // Add a third region with invalid geometry to verify it is blocked
    const invalidId = randomUUID();
    sourceImages.set(invalidId, document.rasterizeRegion(0, fixtures.CHART_BOX));
    const invalidRegion = {
      id: invalidId,
      job_id: jobId,
      page_number: 3,
      type: "diagram" as const,
      bounding_box: fixtures.CHART_BOX,
      review_status: "pending" as const,
      extracted_data: {
        kind: "diagram" as const,
        status: "processed" as const,
        source: "gemini" as const,
        data: charts[0],
        needs_data_review: false,
        warnings: [],
        geometry_processing: {
          status: "failed" as const,
          error: {
            code: "BANA_VIOLATION",
            message: "This geometry did not pass validation and cannot be previewed.",
          },
        },
      },
      geometry: null,
      source_preview: { url: `/api/jobs/${jobId}/regions/${invalidId}/source` },
    };

    document.destroy();

    const allRegions = [...validRegions, invalidRegion];
    return {
      job_id: jobId,
      status: "ready_for_review",
      page_count: 3,
      pages: allRegions.map((region) => ({
        page_number: region.page_number,
        status: "classified",
        regions: [region],
      })),
    };
  } catch (error) {
    throw new Error(`Could not load Phase 4 fixtures/Phase 5 generator: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const payload = await fixtureResponse();
let spawnedServer: ChildProcess | undefined;
let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined;

try {
  spawnedServer = await ensureServerRunning(base);
  browser = await launchBrowser();
  const { cdp } = browser;

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("DOM.enable");
  await cdp.send("Fetch.enable", { patterns: [{ requestStage: "Request" }] });

  cdp.onEvent((message) => {
    if (message.method !== "Fetch.requestPaused" || !message.params) return;
    const params = message.params as unknown as CdpRequestPausedParams;
    const { request, requestId } = params;
    requestedUrls.push(request.url);

    // Guard: Ensure zero Gemini or Supabase network calls occur
    assert.equal(
      request.url.includes("generativelanguage.googleapis.com"),
      false,
      "External Gemini request was attempted during smoke test"
    );
    assert.equal(
      request.url.includes("supabase.co"),
      false,
      "External Supabase request was attempted during smoke test"
    );

    const url = new URL(request.url, base);
    const finish = (status: number, body: Uint8Array | string, contentType: string) => {
      void cdp.send("Fetch.fulfillRequest", {
        requestId,
        responseCode: status,
        responseHeaders: [
          { name: "Content-Type", value: contentType },
          { name: "Access-Control-Allow-Origin", value: "*" },
        ],
        body: Buffer.from(body).toString("base64"),
      });
    };

    if (url.pathname === "/api/upload" && request.method === "POST") {
      finish(200, JSON.stringify(payload), "application/json");
    } else if (url.pathname.includes("/source")) {
      const parts = url.pathname.split("/");
      const regionId = parts[parts.length - 2] || "";
      const isExpired = url.searchParams.get("expired") === "1";
      const image = sourceImages.get(regionId) || new Uint8Array();
      finish(isExpired ? 410 : 200, isExpired ? "Preview expired" : image, isExpired ? "text/plain" : "image/png");
    } else if (url.origin === new URL(base).origin) {
      void cdp.send("Fetch.continueRequest", { requestId });
    } else {
      void cdp.send("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" });
    }
  });

  // 1. Navigate to application with desktop dimensions
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url: base });
  await waitFor(cdp, "Boolean(document.querySelector('input[type=file]'))");

  // 2. Upload flow with fixture data
  const pdf = join(artifactDir, "fixture.pdf");
  const { createDiagramFixture } = await import("../tests/diagram-extraction/fixtures.ts");
  await writeFile(pdf, createDiagramFixture());

  const hasFileInput = await evaluate<boolean>(cdp, "document.querySelector('input[type=file]') !== null");
  assert.equal(hasFileInput, true, "upload file input is present");

  const root = await cdp.send<CdpGetDocumentResult>("DOM.getDocument", { depth: -1 });
  const node = await cdp.send<CdpQuerySelectorResult>("DOM.querySelector", {
    nodeId: root.root.nodeId,
    selector: "input[type=file]",
  });
  await cdp.send("DOM.setFileInputFiles", { nodeId: node.nodeId, files: [pdf] });
  await evaluate(cdp, "document.querySelector('input[type=file]')?.dispatchEvent(new Event('change', { bubbles: true }))");
  await waitFor(cdp, "Boolean([...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Process document')))");
  await evaluate(cdp, "([...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Process document'))?.click())");
  await waitFor(cdp, "document.body.innerText.includes('Region 1 of')");

  const initialText = await evaluate<string>(cdp, "document.body.innerText");
  assert.match(initialText, /Review generated output|Region 1 of/);

  // 3. Verify real source image loaded
  await waitFor(cdp, "document.querySelector('img[alt^=\"Source crop\"]')?.complete === true");
  const imageLoaded = await evaluate<boolean>(cdp, "document.querySelector('img[alt^=\"Source crop\"]')?.complete === true");
  assert.equal(imageLoaded, true, "source preview image loaded successfully");

  // 4. Verify 3D canvas is present for valid region
  await waitFor(cdp, "Boolean(document.querySelector('canvas'))");
  const hasCanvas = await evaluate<boolean>(cdp, "document.querySelector('canvas') !== null");
  assert.equal(hasCanvas, true, "tactile 3D canvas is rendered for valid diagram");
  await delay(400);

  // 5. Verify camera controls change the preview
  const beforeScreenshot = (await cdp.send<CdpCaptureScreenshotResult>("Page.captureScreenshot", { format: "png" })).data;
  await evaluate(cdp, "([...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Top-down tactile view')?.click())");
  await delay(400);
  const afterScreenshot = (await cdp.send<CdpCaptureScreenshotResult>("Page.captureScreenshot", { format: "png" })).data;
  assert.notEqual(afterScreenshot, beforeScreenshot, "camera controls change the rendered preview");

  // 6. Verify WebGL failure displays a clear message (context lost)
  await evaluate(cdp, "document.querySelector('canvas')?.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))");
  await waitFor(cdp, "document.body.innerText.includes('lost its graphics context')");
  const contextLostText = await evaluate<string>(cdp, "document.body.innerText");
  assert.match(contextLostText, /lost its graphics context/);

  // 7. Verify region navigation (Next region -> Region 2 of 3)
  await evaluate(cdp, "([...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Next'))?.click())");
  await waitFor(cdp, "document.body.innerText.includes('Region 2 of 3')");

  // 8. Verify expired source preview handling (HTTP 410)
  await evaluate(cdp, `document.querySelector('img')?.setAttribute('src', ${JSON.stringify(sourceExpiryUrl)})`);
  await waitFor(cdp, "document.body.innerText.toLowerCase().includes('expired')");
  const expiredText = await evaluate<string>(cdp, "document.body.innerText");
  assert.match(expiredText.toLowerCase(), /expired/);

  // 9. Verify invalid geometry is blocked (Next region -> Region 3 of 3)
  await evaluate(cdp, "([...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Next'))?.click())");
  await waitFor(cdp, "document.body.innerText.includes('Region 3 of 3')");
  const invalidRegionText = await evaluate<string>(cdp, "document.body.innerText");
  assert.match(invalidRegionText, /did not pass validation and cannot be previewed/);
  const invalidCanvas = await evaluate<boolean>(cdp, "document.querySelector('canvas') !== null");
  assert.equal(invalidCanvas, false, "3D canvas is blocked when geometry is invalid");

  // Navigate back to Region 1 to capture healthy desktop & mobile screenshots
  await evaluate(cdp, "([...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Previous'))?.click())");
  await delay(150);
  await evaluate(cdp, "([...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Previous'))?.click())");
  await waitFor(cdp, "document.body.innerText.includes('Region 1 of 3')");

  // 10. Capture and preserve desktop & mobile screenshots as temporary artifacts
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await delay(200);
  const desktopData = (await cdp.send<CdpCaptureScreenshotResult>("Page.captureScreenshot", { format: "png" })).data;
  await writeFile(join(artifactDir, "desktop.png"), Buffer.from(desktopData, "base64"));

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(200);
  const mobileData = (await cdp.send<CdpCaptureScreenshotResult>("Page.captureScreenshot", { format: "png" })).data;
  await writeFile(join(artifactDir, "mobile.png"), Buffer.from(mobileData, "base64"));

  // 11. Final assertion: Zero external calls to Gemini or Supabase
  assert.equal(
    requestedUrls.some((u) => u.includes("googleapis.com") || u.includes("supabase.co")),
    false,
    "No Gemini or Supabase calls occurred during the test"
  );

  console.log(`Phase 6 browser verification passed. Artifacts preserved at: ${artifactDir}`);
} finally {
  if (browser) {
    try {
      browser.cdp.close();
    } catch {
      // ignore
    }
    await terminateProcessSafely(browser.process);
    await rm(browser.dir, { recursive: true, force: true }).catch(() => {});
  }
  if (spawnedServer) {
    await terminateProcessSafely(spawnedServer);
  }
}
