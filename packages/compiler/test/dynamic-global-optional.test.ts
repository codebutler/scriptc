import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";

async function compiles(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-dynamic-global-"));
  try {
    const entry = join(dir, "main.mjs");
    writeFileSync(entry, source);
    const result = await compile(entry, {
      outputKind: "ir",
      outDir: dir,
      outPath: join(dir, "module.ir.json"),
    });
    expect(result.ok ? [] : result.diagnostics).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("early reads keep frozen globals in checked-dynamic storage", async () => {
  await compiles(`
console.log(read());
var value = Object.freeze({ type: "space", loc: null, text: " " });
function read() { return value; }
console.log(JSON.stringify(read()));
`);
});

test("export getters before frozen globals keep consistent storage", async () => {
  await compiles(`
var registry = {};
Object.defineProperty(registry, "read", { get: () => read, enumerable: true });
var value = Object.freeze({ type: "space", loc: null, text: " " });
function read() { return value; }
console.log(JSON.stringify(registry.read()));
`);
});
