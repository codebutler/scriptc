import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { analyze } from "../src/index.js";
function diagnostics(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-union-typeof-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(entry, source);
    const { coverage } = analyze(entry);
    return [...coverage.diagnostics, ...(coverage.runtimeFences ?? [])];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test("typeof tests several union arms from one effectful read", () => {
  expect(
    diagnostics(`
type Value = { a: number } | { b: string } | number;
let calls = 0;
function value(n: number): Value { calls++; return n === 0 ? {a: 2} : n === 1 ? {b: "x"} : 3; }
console.log(typeof value(0) === "object", typeof value(1) !== "object", calls);
`),
  ).toEqual([]);
});
test("a folded union typeof test retains its effectful operand", () => {
  expect(
    diagnostics(`
type Value = { a: number } | { b: string };
let calls = 0;
function value(n: number): Value { calls++; return n === 0 ? {a: 2} : {b: "x"}; }
console.log(typeof value(0) === "object", typeof value(1) === "string", calls);
`),
  ).toEqual([]);
});
