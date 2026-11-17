import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import type { IrModule } from "../src/ir/ir.js";

test("initializer retry keeps the binding already captured by its own methods", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-self-capture-retry-"));
  try {
    const entry = join(dir, "main.ts"),
      output = join(dir, "main.ir.json");
    writeFileSync(
      entry,
      `
interface Kit { color(n:number):number; parse(s:string):number; make():number; size(input:ArrayBuffer|Uint8Array):number }
function create(seed:number): Kit {
 const kit:Kit={
  color(n) { return n+seed; },
  parse(s) { return kit.color(Number(s)); },
  size(input:ArrayBuffer|Uint8Array) { return input.byteLength; },
  make() { return later(); },
 };
 const later=kit.parse.bind(kit,"7");
 return kit;
}
const first=create(1),second=create(2);
console.log(first.parse("3"),first.make(),second.make());
console.log(first.size(new Uint8Array([1,2,3])));
`,
    );
    const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
    expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
    if (!result.ok) return;
    const module = JSON.parse(readFileSync(output, "utf8")) as IrModule;
    const fn = module.functions.find((fn) => fn.name === "create");
    expect(fn).toBeDefined();
    if (!fn) return;
    const bindings = fn.locals.filter((local) => local.name === "kit");
    expect(bindings).toHaveLength(1);
    const binding = bindings[0];
    if (!binding) return;
    expect(binding.boxed).toBe(true);
    expect(binding.tdz).toBe(true);
    const declaration = fn.body.findIndex(
      (stmt) => stmt.kind === "varDecl" && stmt.localId === binding.id,
    );
    const initialization = fn.body.findIndex(
      (stmt) => stmt.kind === "assign" && stmt.localId === binding.id && stmt.initializes,
    );
    expect(declaration).toBeGreaterThanOrEqual(0);
    expect(initialization).toBeGreaterThan(declaration);
    expect(JSON.stringify(fn.body[initialization])).toContain('"kind":"closure"');
    expect(JSON.stringify(fn.body[initialization])).toContain(binding.id);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
