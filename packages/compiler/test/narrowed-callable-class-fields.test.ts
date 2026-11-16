import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { analyze } from "../src/index.js";

function diagnostics(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-callable-field-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(entry, source);
    const { coverage } = analyze(entry);
    return [...coverage.diagnostics, ...(coverage.runtimeFences ?? [])];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("a narrowed callback or data field uses its stored callable signature", () => {
  expect(
    diagnostics(`
class Source {
  value: { n: number } | (() => { n: number });
  constructor(value: { n: number } | (() => { n: number })) { this.value = value; }
  read() { return typeof this.value === "function" ? this.value() : this.value; }
}
console.log(new Source(() => ({ n: 3 })).read().n);
`),
  ).toEqual([]);
});

test("a data-or-rest callback field retains its unsupported call fence", () => {
  expect(
    diagnostics(`
class Source {
  value: { n: number } | ((...values: number[]) => number);
  constructor(value: { n: number } | ((...values: number[]) => number)) { this.value = value; }
  read() { return typeof this.value === "function" ? this.value(1, 2) : this.value.n; }
}
console.log(new Source((...values: number[]) => values.length).read());
`).some((diagnostic) => diagnostic.code === "SC1090"),
  ).toBe(true);
});
