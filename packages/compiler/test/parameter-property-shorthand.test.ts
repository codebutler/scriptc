import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { analyze } from "../src/index.js";

function diagnostics(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-param-shorthand-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(entry, source);
    const { coverage } = analyze(entry);
    return [...coverage.diagnostics, ...(coverage.runtimeFences ?? [])];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("parameter-property shorthand reads the constructor parameter", () => {
  expect(
    diagnostics(`
class Scope {
  saved: { changed: () => number };
  constructor(public changed: () => number) {
    this.changed = () => 9;
    this.saved = { changed };
  }
}
console.log(new Scope(() => 3).saved.changed());
`),
  ).toEqual([]);
});

test("parameter-property shorthand threads an arrow capture", () => {
  expect(
    diagnostics(`
class Scope {
  read: () => { value: number };
  constructor(readonly value: number = 4) {
    this.read = () => ({ value });
  }
}
console.log(new Scope().read().value);
`),
  ).toEqual([]);
});
