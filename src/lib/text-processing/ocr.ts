import "server-only";

import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { Worker } from "node:worker_threads";

import { TextProcessingError } from "./errors.ts";
import type { TextRecognizer } from "./types.ts";

const require = createRequire(import.meta.url);
const OCR_TIMEOUT_MS = 60_000;
const MIN_OCR_CONFIDENCE = 60;

export class LocalTextRecognizer implements TextRecognizer {
  async recognize(png: Uint8Array): Promise<{ text: string; confidence: number }> {
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Own the worker before Tesseract starts. Its createWorker promise can
      // remain pending on initialization failure, hiding the thread to terminate.
      worker = new Worker(join(process.cwd(), "src/lib/text-processing/ocr-worker.cjs"), {
        workerData: {
          png,
          languagePath: join(dirname(require.resolve("@tesseract.js-data/eng/package.json")), "4.0.0"),
        },
      });
      const activeWorker = worker;
      return await new Promise<{ text: string; confidence: number }>((resolve, reject) => {
        timer = setTimeout(() => reject(new TextProcessingError("OCR_TIMEOUT",
          "Reading this scanned region took too long. Please try a clearer scan.")), OCR_TIMEOUT_MS);
        activeWorker.once("error", reject);
        activeWorker.once("exit", () => reject(new Error("OCR worker exited before returning text.")));
        activeWorker.once("message", (data: { text?: unknown; confidence?: unknown }) => {
          if (typeof data?.text !== "string" || typeof data.confidence !== "number") {
            reject(new Error("OCR did not return a valid result."));
          } else if (!data.text.trim()) {
            reject(new TextProcessingError("OCR_EMPTY",
              "No readable text was found in this scanned region. Please use a clearer scan."));
          } else if (!Number.isFinite(data.confidence) || data.confidence < MIN_OCR_CONFIDENCE || data.confidence > 100) {
            reject(new TextProcessingError("OCR_LOW_CONFIDENCE",
              "This scanned text could not be read confidently. Please upload a clearer scan."));
          } else {
            resolve({ text: data.text.trim(), confidence: data.confidence });
          }
        });
      });
    } catch (error) {
      if (error instanceof TextProcessingError) throw error;
      throw new TextProcessingError("OCR_FAILED", "This scanned region could not be read. Please try a clearer scan or a PDF with selectable text.");
    } finally {
      clearTimeout(timer);
      // This also stops the nested Tesseract worker if initialization failed.
      if (worker) await worker.terminate();
    }
  }
}
