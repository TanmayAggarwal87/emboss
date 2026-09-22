import { UploadError } from "./errors.ts";

const MULTIPART_OVERHEAD_ALLOWANCE_BYTES = 64 * 1024;
const PDF_HEADER = "%PDF-";
const PDF_HEADER_SEARCH_BYTES = 1024;

export async function readValidatedPdf(
  request: Request,
  maxUploadBytes: number,
): Promise<Uint8Array> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new UploadError(
      415,
      "INVALID_CONTENT_TYPE",
      "Upload the PDF as multipart form data.",
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > maxUploadBytes + MULTIPART_OVERHEAD_ALLOWANCE_BYTES
  ) {
    throw fileTooLargeError(maxUploadBytes);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new UploadError(
      400,
      "INVALID_FORM_DATA",
      "The upload could not be read. Choose the PDF and try again.",
    );
  }

  const file = formData.get("file");
  if (!isFile(file)) {
    throw new UploadError(
      400,
      "MISSING_FILE",
      "Choose a PDF file to upload.",
    );
  }

  if (file.size > maxUploadBytes) {
    throw fileTooLargeError(maxUploadBytes);
  }

  if (
    !file.name.toLowerCase().endsWith(".pdf") ||
    (file.type !== "" && file.type.toLowerCase() !== "application/pdf")
  ) {
    throw new UploadError(
      415,
      "INVALID_FILE_TYPE",
      "Only PDF files are supported.",
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = new TextDecoder("latin1").decode(
    bytes.subarray(0, PDF_HEADER_SEARCH_BYTES),
  );

  if (!header.includes(PDF_HEADER)) {
    throw new UploadError(
      415,
      "INVALID_FILE_TYPE",
      "This file does not appear to be a valid PDF.",
    );
  }

  return bytes;
}

export function validatePageCount(pageCount: number, maxPages: number): void {
  if (pageCount < 2 || pageCount > maxPages) {
    throw new UploadError(
      422,
      "PAGE_COUNT_OUT_OF_RANGE",
      `This PDF has ${pageCount} ${pageCount === 1 ? "page" : "pages"}. Emboss currently supports PDFs with 2 to ${maxPages} pages.`,
    );
  }
}

function isFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    "arrayBuffer" in value
  );
}

function fileTooLargeError(maxUploadBytes: number): UploadError {
  return new UploadError(
    413,
    "FILE_TOO_LARGE",
    `This PDF is larger than ${maxUploadBytes / 1024 / 1024} MB. Choose a smaller file and try again.`,
  );
}
