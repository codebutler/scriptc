import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { analyze } from "../src/index.js";

function diagnostics(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-indexed-union-predicates-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(entry, source);
    const { coverage } = analyze(entry);
    return [...coverage.diagnostics, ...(coverage.runtimeFences ?? [])];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("some and every dispatch numeric array and typed-array arms", () => {
  expect(
    diagnostics(`
type Values = number[] | Float32Array | Uint16Array;
function finite(value: Values) { return value.every(Number.isFinite); }
function positive(value: Values) { return value.some((n, i, original) => n > i && original === value); }
console.log(finite([1, 2]), finite(new Float32Array([Infinity])));
console.log(positive(new Uint16Array([0, 2])));
`),
  ).toEqual([]);
});

test("mixed indexed predicates retain void-result and thisArg refusals", () => {
  for (const call of [
    "value.every(callback)",
    "value.some(callback)",
    "value.every(n => n > 0, {})",
  ]) {
    expect(
      diagnostics(`
function test(value: number[] | Float32Array, callback: (n: number) => void) {
  return ${call};
}
console.log(test([1], n => { console.log(n); }));
`).some((d) => d.code === "SC1090" || d.code === "SC2020"),
    ).toBe(true);
  }
});
