import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { analyze } from "../src/index.js";

function diagnostics(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-js-heterogeneous-field-writes-"));
  try {
    const entry = join(dir, "main.mjs");
    writeFileSync(entry, source);
    const { coverage } = analyze(entry);
    return [...coverage.diagnostics, ...(coverage.runtimeFences ?? [])];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("direct unannotated JS property stores retain their actual values", () => {
  expect(
    diagnostics(`
function build() { const value = {kind:false}; value.kind = "node"; return value.kind; }
console.log(build());
`),
  ).toEqual([]);
});
test("annotated JS records retain their declared field contract", () => {
  expect(
    diagnostics(`
function build() { /** @type {{kind:boolean}} */ const value = {kind:false}; value.kind = "node"; return value.kind; }
console.log(build());
`).some((d) => d.code === "SC1090"),
  ).toBe(true);
});
test("annotated JS properties retain their declared field contract", () => {
  expect(
    diagnostics(`
function build() { const value = {/** @type {boolean} */ kind:false}; value.kind = "node"; return value.kind; }
console.log(build());
`).some((d) => d.code === "SC1090"),
  ).toBe(true);
});
