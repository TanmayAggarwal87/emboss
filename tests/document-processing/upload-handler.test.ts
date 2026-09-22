import assert from "node:assert/strict";
import test from "node:test";

import { UploadRateLimiter } from "../../src/lib/document-processing/rate-limit.ts";
import { createUploadHandler } from "../../src/lib/document-processing/upload-handler.ts";
import { EXPECTED_CHARTS } from "../diagram-extraction/fixtures.ts";
import type {
  ClassifiedRegion,
  JobRepository,
  PdfDocumentHandle,
  PersistedRegion,
  RasterizedPage,
  RegionClassifier,
} from "../../src/lib/document-processing/types.ts";

const config = {
  maxPdfPages: 3,
  maxUploadBytes: 7 * 1024 * 1024,
  uploadsPerIp: 5,
  maxGeminiValidationAttempts: 3,
};

// Request requires an absolute URL, but the handler is invoked directly; no HTTP
// connection is made. The IPs are RFC 5737 TEST-NET addresses reserved for examples.
const TEST_UPLOAD_URL = "http://localhost/api/upload";
const DEFAULT_TEST_CLIENT_IP = "198.51.100.7";
const RATE_LIMIT_TEST_CLIENT_IP = "203.0.113.8";

test("rejects a non-PDF before opening MuPDF", async () => {
  const harness = createHarness();
  const response = await harness.handler(
    uploadRequest(new File(["hello"], "notes.txt", { type: "text/plain" })),
  );

  assert.equal(response.status, 415);
  assert.equal((await response.json()).error.code, "INVALID_FILE_TYPE");
  assert.equal(harness.openCalls(), 0);
});

test("rejects a PDF over 7 MB before opening MuPDF", async () => {
  const harness = createHarness();
  const response = await harness.handler(
    uploadRequest(
      new File([new Uint8Array(config.maxUploadBytes + 1)], "large.pdf", {
        type: "application/pdf",
      }),
    ),
  );

  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, "FILE_TOO_LARGE");
  assert.equal(harness.openCalls(), 0);
});

test("rejects a PDF outside the 2-3 page scope before job creation", async () => {
  const harness = createHarness({ pageCount: 4 });
  const response = await harness.handler(uploadRequest(validPdfFile()));

  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, "PAGE_COUNT_OUT_OF_RANGE");
  assert.equal(harness.createdJobs.length, 0);
  assert.equal(harness.classificationCalls(), 0);
});

test("limits the sixth upload request from the same IP", async () => {
  const harness = createHarness();

  for (let requestNumber = 1; requestNumber <= 5; requestNumber += 1) {
    const response = await harness.handler(
      uploadRequest(
        new File(["hello"], "notes.txt", { type: "text/plain" }),
        RATE_LIMIT_TEST_CLIENT_IP,
      ),
    );
    assert.equal(response.status, 415);
  }

  const blocked = await harness.handler(
    uploadRequest(
      new File(["hello"], "notes.txt", { type: "text/plain" }),
      RATE_LIMIT_TEST_CLIENT_IP,
    ),
  );
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error.code, "RATE_LIMITED");
});

test("creates a processing job and pending rows for every classified region", async () => {
  const harness = createHarness();
  const response = await harness.handler(uploadRequest(validPdfFile()));
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.deepEqual(harness.createdJobs, [2]);
  assert.equal(harness.insertedRegions.length, 2);
  assert.deepEqual(
    harness.insertedRegions.map((entry) => entry.regions[0]?.type),
    ["text", "diagram"],
  );
  assert.ok(
    harness.insertedRegions.every((entry) =>
      entry.persisted.every((region) => region.review_status === "pending"),
    ),
  );
  assert.equal(body.status, "processing");
  assert.equal(body.pages[0].has_text_layer, true);
  assert.equal("text" in body.pages[0].regions[0], false);
});

test("keeps successful pages when one page classification fails", async () => {
  const harness = createHarness({ failedPage: 2 });
  const response = await harness.handler(uploadRequest(validPdfFile()));
  const body = await response.json();

  assert.equal(response.status, 207);
  assert.equal(body.status, "processing");
  assert.equal(body.pages[0].status, "classified");
  assert.equal(body.pages[1].status, "failed");
  assert.match(body.pages[1].error, /rest of the document can still continue/i);
  assert.equal(harness.insertedRegions.length, 1);
});

function createHarness(
  options: { pageCount?: number; failedPage?: number } = {},
) {
  let opened = 0;
  let classified = 0;
  const createdJobs: number[] = [];
  const insertedRegions: Array<{
    pageNumber: number;
    regions: ClassifiedRegion[];
    persisted: PersistedRegion[];
  }> = [];

  const pageCount = options.pageCount ?? 2;
  const document: PdfDocumentHandle = {
    pageCount,
    extractTextRegion() { return "fixture text"; },
    rasterizeRegion() { return new Uint8Array(); },
    inspectTableRegion() { throw new Error("This fixture has no tables."); },
    rasterizePage(pageIndex: number): RasterizedPage {
      return {
        pageNumber: pageIndex + 1,
        width: 600,
        height: 800,
        pngBase64: "cG5n",
        hasTextLayer: true,
      };
    },
    destroy() {},
  };

  const classifier: RegionClassifier = {
    async classify(page) {
      classified += 1;
      if (page.pageNumber === options.failedPage) {
        throw new Error("simulated provider failure");
      }
      return [
        {
          region_id: `r${page.pageNumber}`,
          type: page.pageNumber === 1 ? "text" : "diagram",
          bounding_box: { x: 10, y: 20, width: 200, height: 100 },
        },
      ];
    },
  };

  const repository: JobRepository = {
    async createJob(count) {
      createdJobs.push(count);
      return "00000000-0000-4000-8000-000000000001";
    },
    async insertRegions(_jobId, pageNumber, regions) {
      const persisted = regions.map((region, index) => ({
        id: `00000000-0000-4000-8000-00000000000${pageNumber + index}`,
        type: region.type,
        bounding_box: region.bounding_box,
        review_status: "pending" as const,
      }));
      insertedRegions.push({ pageNumber, regions, persisted });
      return persisted;
    },
    async markJobFailed() {},
  };

  return {
    handler: createUploadHandler({
      config,
      rateLimiter: new UploadRateLimiter(),
      openPdf() {
        opened += 1;
        return document;
      },
      classifier,
      repository,
      tableProcessor: { process() { throw new Error("This fixture has no tables."); } },
      diagramProcessor: { async process() { return { kind: "diagram", status: "processed", source: "gemini",
        data: EXPECTED_CHARTS[0], needs_data_review: false, warnings: [] }; } },
      textProcessor: {
        async process() {
          return { kind: "text", status: "processed", source: "text_layer", plain_text: "fixture text",
            braille: "⠋", braille_grade: 2, braille_code: "UEB", translation_table: "en-ueb-g2.ctb",
            liblouis_version: "test", ocr_confidence: null, warnings: [] };
        },
      },
    }),
    createdJobs,
    insertedRegions,
    openCalls: () => opened,
    classificationCalls: () => classified,
  };
}

function validPdfFile(): File {
  return new File(["%PDF-1.7\nfixture"], "lesson.pdf", {
    type: "application/pdf",
  });
}

function uploadRequest(file: File, ip = DEFAULT_TEST_CLIENT_IP): Request {
  const formData = new FormData();
  formData.set("file", file);
  return new Request(TEST_UPLOAD_URL, {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: formData,
  });
}
