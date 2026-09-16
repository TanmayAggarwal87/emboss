// Native CommonJS worker entry, loaded directly by Node rather than Next.js.
// No document text is logged or written to disk.
/* eslint-disable @typescript-eslint/no-require-imports */
const { parentPort, workerData } = require("node:worker_threads");
const { createWorker, OEM, PSM } = require("tesseract.js");

async function recognize() {
  let worker;
  try {
    worker = await createWorker("eng", OEM.LSTM_ONLY, {
      langPath: workerData.languagePath,
      cacheMethod: "none",
      gzip: true,
      // Notify the owner even when Tesseract leaves initialization pending.
      errorHandler() { parentPort.postMessage({ failed: true }); },
    });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const { data } = await worker.recognize(Buffer.from(workerData.png), {}, { text: true });
    parentPort.postMessage({ text: data.text, confidence: data.confidence });
  } catch {
    parentPort.postMessage({ failed: true });
  } finally {
    if (worker) await worker.terminate();
  }
}

void recognize();
