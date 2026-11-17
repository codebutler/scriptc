import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import type { IrModule } from "../src/ir/ir.js";

test("a local class binding is allocated before hoisted helpers capture it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-local-class-forward-"));
  try {
    const entry = join(dir, "main.ts"),
      output = join(dir, "main.ir.json");
    writeFileSync(
      entry,
      `
function factory(value:number) {
  class Item { value=value; again():Item { return first(); } }
  function first():Item { return second(); }
  function second():Item { return new Item(); }
  return first();
}
console.log(factory(1).again().value);
`,
    );
    const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
    expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
    if (!result.ok) return;
    const module = JSON.parse(readFileSync(output, "utf8")) as IrModule;
    const fn = module.functions.find((fn) => fn.name === "factory");
    expect(fn).toBeDefined();
    if (!fn) return;
    const binding = fn.locals.find((local) => local.name === "Item");
    expect(binding?.boxed).toBe(true);
    if (!binding) return;
    const declaration = fn.body.findIndex(
      (stmt) => stmt.kind === "varDecl" && stmt.localId === binding.id,
    );
    const initialization = fn.body.findIndex(
      (stmt) => stmt.kind === "assign" && stmt.localId === binding.id,
    );
    expect(declaration).toBeGreaterThanOrEqual(0);
    expect(initialization).toBeGreaterThan(declaration);
    const prefix = JSON.stringify(fn.body.slice(declaration + 1, initialization));
    expect(prefix).toContain('"kind":"closure"');
    expect(prefix).toContain(binding.id);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
