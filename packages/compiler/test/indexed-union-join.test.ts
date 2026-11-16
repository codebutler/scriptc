import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { analyze } from "../src/index.js";

function diagnostics(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-indexed-union-join-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(entry, source);
    const { coverage } = analyze(entry);
    return [...coverage.diagnostics, ...(coverage.runtimeFences ?? [])];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("join dispatches mixed numeric array union arms", () => {
  expect(
    diagnostics(`
function joined(value: number[] | Float32Array | Uint16Array, sep?: string) {
  return value.join(sep);
}
console.log(joined([1, 2]), joined(new Float32Array([3, 4]), "|"));
`),
  ).toEqual([]);
});
