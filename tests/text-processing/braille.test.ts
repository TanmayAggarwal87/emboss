import assert from "node:assert/strict";
import test from "node:test";
import { translateBraille } from "../../src/lib/text-processing/braille.ts";
import { getBrailleGrade } from "../../src/lib/text-processing/config.ts";
import { REFERENCE_TEXT, REFERENCE_GRADE_1, REFERENCE_GRADE_2 } from "./fixtures.ts";

test("English UEB Grade 1 and Grade 2 match fixed reference cells", () => {
  assert.equal(translateBraille(REFERENCE_TEXT, 1).braille, REFERENCE_GRADE_1);
  assert.equal(translateBraille(REFERENCE_TEXT, 2).braille, REFERENCE_GRADE_2);
  assert.equal(translateBraille("123", 1).braille, "⠼⠁⠃⠉");
  assert.equal(translateBraille("123", 2).braille, "⠼⠁⠃⠉");
});

test("preserves line/paragraph breaks and expanding indicators without truncation", () => {
  assert.equal(translateBraille("The\n\n123", 2).braille, "⠠⠮\n\n⠼⠁⠃⠉");
  const input = Array.from({ length: 2000 }, () => "1.").join(" ");
  assert.ok(translateBraille(input, 1).braille === Array.from({ length: 2000 }, () => "⠼⠁⠲").join(" "), "Every number and period must survive output expansion.");
  assert.equal(translateBraille("", 1).braille, "");
});

test("rejects unreadable and unsupported characters and excessive text", () => {
  for (const value of ["bad\u0000text", "bad\ufffdtext", "😀", "漢"]) {
    assert.throws(() => translateBraille(value, 2), /unsupported|could not|unreadable/i);
  }
  assert.throws(() => translateBraille("a".repeat(100_001), 2), /too large/);
});

test("braille config defaults to Grade 2 and rejects invalid grades", () => {
  assert.equal(getBrailleGrade({}), 2);
  assert.equal(getBrailleGrade({ BRAILLE_GRADE: "1" }), 1);
  assert.throws(() => getBrailleGrade({ BRAILLE_GRADE: "3" }), /must be 1 or 2/);
});
