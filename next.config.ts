import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mupdf", "liblouis", "tesseract.js", "@tesseract.js-data/eng"],
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./docs/prompts.md",
      "./src/lib/phase2/ocr-worker.cjs",
      "./node_modules/tesseract.js/src/**/*",
      "./node_modules/liblouis-build/tables/**/*",
      "./node_modules/tesseract.js/src/worker-script/**/*",
      "./node_modules/tesseract.js-core/*.wasm*",
      "./node_modules/@tesseract.js-data/eng/4.0.0/*",
    ],
  },
};

export default nextConfig;
