import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { analyze } from "../src/index.js";

function diagnostics(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-array-from-narrowing-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(entry, source);
    const { coverage } = analyze(entry);
    return [...coverage.diagnostics, ...(coverage.runtimeFences ?? [])];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("Array.from honors narrowed optional indexed-union properties", () => {
  expect(
    diagnostics(`
type Color = Float32Array | number[];
function copy(style: { color?: Color }): number[] {
  if (!style.color) return [];
  return Array.from(style.color);
}
console.log(copy({color: [1, 2]}).join(","));
console.log(copy({color: new Float32Array([3, 4])}).join(","));
`),
  ).toEqual([]);
});

test("Array.from honors narrowed nullable indexed-union bindings", () => {
  expect(
    diagnostics(`
type Color = Uint8Array | number[];
function copy(value: Color | null): number[] {
  if (value === null) return [];
  return Array.from(value);
}
console.log(copy([1, 2]).join(","));
`),
  ).toEqual([]);
});
