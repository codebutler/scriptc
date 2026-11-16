import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { analyze } from "../src/index.js";

function diagnostics(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-promise-set-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(entry, source);
    const { coverage } = analyze(entry);
    return [...coverage.diagnostics, ...(coverage.runtimeFences ?? [])];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("typed promise sets feed settled combinators", () => {
  expect(
    diagnostics(`
const jobs = new Set<Promise<number>>([Promise.resolve(2), Promise.resolve(3)]);
Promise.allSettled(jobs).then(results => console.log(results.length));
Promise.any(jobs).then(value => console.log(value));
`),
  ).toEqual([]);
});
test("sets of plain values keep the typed combinator refusal", () => {
  expect(
    diagnostics(`
Promise.allSettled(new Set([2, 3])).then(results => console.log(results.length));
`).some((diagnostic) => diagnostic.code === "SC2020"),
  ).toBe(true);
});
