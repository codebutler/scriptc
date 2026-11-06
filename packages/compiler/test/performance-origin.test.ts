import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";

async function compileSource(source: string) {
  const directory = mkdtempSync(join(tmpdir(), "scriptc-perf-origin-"));
  try {
    const entry = join(directory, "main.ts");
    const output = join(directory, "program.ir");
    writeFileSync(entry, source);
    const result = await compile(entry, { outDir: directory, outPath: output, outputKind: "ir" });
    return { result, ir: result.ok ? readFileSync(output, "utf8") : "" };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("timeOrigin reads use the numeric runtime operation for supported provenance", async () => {
  const { result, ir } = await compileSource(`
import { performance as clock } from "node:perf_hooks";
import * as hooks from "node:perf_hooks";
console.log(performance.timeOrigin, globalThis.performance.timeOrigin, clock.timeOrigin, hooks.performance.timeOrigin);
`);
  expect(result.ok, JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(true);
  expect(ir).toContain("perf.timeOrigin");
});

test("presence and shadowed objects need no origin runtime", async () => {
  const { result, ir } = await compileSource(`
console.log(typeof performance.timeOrigin);
function local() { const performance = { timeOrigin: 4 }; return performance.timeOrigin; }
console.log(local());
`);
  expect(result.ok, JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(true);
  expect(ir).not.toContain("perf.timeOrigin");
});

test.each([
  "performance.timeOrigin = 1;",
  "Object.defineProperty(performance, 'timeOrigin', { value: 1 });",
  "console.log(Object.getOwnPropertyDescriptor(performance, 'timeOrigin'));",
  "console.log(Object.keys(performance));",
  "console.log(Object.hasOwn(performance, 'timeOrigin'));",
  "console.log('timeOrigin' in performance);",
  "console.log(Object.getPrototypeOf(performance));",
  "console.log(Object.prototype.hasOwnProperty.call(performance, 'timeOrigin'));",
  "const clock: unknown = performance; console.log(clock);",
])("unsupported performance mutation or reflection is refused: %s", async (source) => {
  const { result } = await compileSource(source);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.diagnostics.some((d) => d.code === "SC9001")).toBe(false);
});
