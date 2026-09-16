import "server-only";

import liblouis from "liblouis";

import { TextProcessingError } from "./errors.ts";
import type { BrailleGrade } from "./types.ts";

// The installed Easy API misuses byte lengths as widechar counts and does not
// check consumed input. Call liblouis itself; never implement translation rules.
interface LouisCapi {
  _malloc(bytes: number): number;
  _free(pointer: number): void;
  setValue(pointer: number, value: number, type: "i16" | "i32"): void;
  getValue(pointer: number, type: "i16" | "i32"): number;
  ccall(name: string, result: "number", types: string[], args: (string | number)[]): number;
}

let initialized = false;
const MAX_TEXT_CHARACTERS = 100_000;

export function translateBraille(plainText: string, grade: BrailleGrade) {
  if (grade !== 1 && grade !== 2) {
    throw new TextProcessingError("BRAILLE_GRADE_INVALID", "Choose braille Grade 1 or Grade 2.");
  }
  if (plainText.length > MAX_TEXT_CHARACTERS) {
    throw new TextProcessingError("TEXT_TOO_LARGE", "This text region is too large to translate safely.");
  }
  // This build uses 16-bit widechar. Do not silently turn unsupported characters
  // or a broken PDF character map into plausible but incorrect braille.
  if (/[\u0000-\u0008\u000b-\u001f\u007f\ud800-\udfff\ufffd]/.test(plainText.replace(/\r\n?/g, "\n"))) {
    throw new TextProcessingError("TEXT_ENCODING_UNSUPPORTED", "This region contains unreadable or unsupported characters. Please use a PDF with correctly encoded English text.");
  }
  try {
    if (!initialized) {
      // Despite its README, liblouis 0.4 does not mount tables automatically.
      liblouis.enableOnDemandTableLoading("");
      liblouis.setLogLevel(liblouis.LOG.OFF);
      if (liblouis.charSize() !== 2) throw new Error("Unexpected liblouis character size.");
      initialized = true;
    }
    const table = `en-ueb-g${grade}.ctb`;
    const tableList = `tables/unicode.dis,tables/${table}`;
    if (!liblouis.checkTable(tableList)) throw new Error("Translation table unavailable.");
    const text = plainText.normalize("NFC").replace(/\r\n?/g, "\n").replace(/\t/g, " ");
    const braille = text.split("\n").map((line) => translateLine(line, tableList)).join("\n");
    if (!/^[\u2800-\u283f \n]*$/u.test(braille) || (text.trim() && !braille.trim())) {
      throw new TextProcessingError("BRAILLE_CHARACTER_UNSUPPORTED", "Some characters could not be translated into English UEB braille. Please check the source text.");
    }
    return { braille, table, version: liblouis.version() };
  } catch (error) {
    if (error instanceof TextProcessingError) throw error;
    throw new TextProcessingError("BRAILLE_TRANSLATION_FAILED", "Braille translation could not finish. Please try again or check the installed liblouis tables.");
  }
}

function translateLine(text: string, table: string): string {
  if (!text) return "";
  const capi = (liblouis as unknown as { capi: LouisCapi }).capi;
  // Generous, bounded expansion for indicators. A partial result is always an
  // error even if liblouis returns success (its documented buffer-full behavior).
  const capacity = text.length * 16 + 64;
  const pointers: number[] = [];
  function allocate(bytes: number) {
    const pointer = capi._malloc(bytes);
    if (!pointer) throw new Error("Could not allocate translation buffer.");
    pointers.push(pointer);
    return pointer;
  }
  try {
    const input = allocate((text.length + 1) * 2);
    const output = allocate(capacity * 2);
    const inputLength = allocate(4);
    const outputLength = allocate(4);
    for (let index = 0; index < text.length; index += 1) {
      capi.setValue(input + index * 2, text.charCodeAt(index), "i16");
    }
    capi.setValue(input + text.length * 2, 0, "i16");
    capi.setValue(inputLength, text.length, "i32");
    capi.setValue(outputLength, capacity, "i32");
    const success = capi.ccall("lou_translateString", "number",
      ["string", "number", "number", "number", "number", "number", "number", "number"],
      [table, input, inputLength, output, outputLength, 0, 0, 0]);
    const used = capi.getValue(outputLength, "i32");
    if (!success || capi.getValue(inputLength, "i32") !== text.length || used < 0 || used > capacity) {
      throw new Error("Liblouis did not translate the complete input.");
    }
    let result = "";
    for (let index = 0; index < used; index += 1) {
      result += String.fromCharCode(capi.getValue(output + index * 2, "i16") & 0xffff);
    }
    return result;
  } finally {
    for (const pointer of pointers) capi._free(pointer);
  }
}
