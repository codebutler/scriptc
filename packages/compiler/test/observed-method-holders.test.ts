import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile, deserializeModule } from "../src/index.js";

/** The IR functions of `source`, by name, as JSON text. */
async function functionsOf(source: string): Promise<Map<string, string>> {
  const dir = await mkdtemp(join(tmpdir(), "scriptc-method-holders-"));
  try {
    const entry = join(dir, "main.ts");
    const outPath = join(dir, "main.ir.json");
    await writeFile(entry, source);
    const result = await compile(entry, { outDir: dir, outPath, outputKind: "ir" });
    if (!result.ok)
      throw new Error(result.diagnostics.map((d) => `${d.code}: ${d.message}`).join("\n"));
    const mod = deserializeModule(await readFile(outPath, "utf8"));
    return new Map(mod.functions.map((fn) => [fn.name, JSON.stringify(fn.body)]));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// The store through a dictionary of unknown values can replace any method,
// so every method call reads its method slot (the observed path).
const SINK = `
class Sink {
  len = 0;
  byte(x: number): Sink { this.len += x; return this; }
}
SUBCLASSES
function poison(v: Record<string, unknown>, k: string): void { v[k] = 1; }
function fill(s: Sink, n: number): number {
  for (let i = 0; i < n; i++) s.byte(i & 7).byte(1);
  return s.len;
}
poison({}, String(process.argv.length));
console.log(fill(new Sink(), 3));
`;

/** What `fill`'s method calls read the method through, and the bodies of
 * the helpers they call. */
async function hotPath(source: string): Promise<{ fill: string; holder: string }> {
  const fns = await functionsOf(source);
  const fill = fns.get("fill");
  if (fill === undefined) throw new Error("no fill function");
  const holder = fns.get("%class.readPropertiesOrPrototype:Sink");
  if (holder === undefined) throw new Error("no method holder for Sink");
  return { fill, holder };
}

test("an observed method call on an instance without own properties creates nothing", async () => {
  const { fill, holder } = await hotPath(SINK.replace("SUBCLASSES", ""));
  expect(fill).toContain('"callee":"%class.readPropertiesOrPrototype:Sink"');
  expect(fill).toContain('"fn":"dyn.bagGet"');
  expect(fill).not.toContain("readProperties:");
  expect(fill).not.toContain('"%dyn.class.readProperties"');
  expect(fill).not.toContain("dyn.objCreate");
  // The absent bag answers the prototype data itself, not a fresh object over it.
  expect(holder).toContain('"callee":"%prototype.data.Sink"');
  expect(holder).not.toContain("dyn.objCreate");
});

test("a method holder selects a subclass instance's prototype without creating anything", async () => {
  const { fill, holder } = await hotPath(
    SINK.replace(
      "SUBCLASSES",
      `class Doubling extends Sink { byte(x: number): Sink { this.len += 2 * x; return this; } }
class Plain extends Sink {}
console.log(new Doubling().byte(1).len, new Plain().byte(1).len);`,
    ),
  );
  expect(fill).toContain('"callee":"%class.readPropertiesOrPrototype:Sink"');
  expect(fill).not.toContain("dyn.objCreate");
  expect(holder).toContain('"callee":"%class.bagPrototype:Sink"');
  expect(holder).not.toContain("dyn.objCreate");
});

test("a method holder knows a subclass constructed only after the calls", async () => {
  // Late's declaration and construction follow every call of fill, so the
  // holder's prototype is chosen once every constructible class is known.
  const fns = await functionsOf(`
class Sink { len = 0; byte(x: number): Sink { this.len += x; return this; } }
function poison(v: Record<string, unknown>, k: string): void { v[k] = 1; }
function fill(s: Sink, n: number): number { for (let i = 0; i < n; i++) s.byte(1); return s.len; }
poison({}, String(process.argv.length));
console.log(fill(new Sink(), 3));
class Late extends Sink { byte(x: number): Sink { this.len += 100 * x; return this; } }
function make(): Sink { return new Late(); }
console.log(fill(make(), 3));
`);
  expect(fns.get("%class.readPropertiesOrPrototype:Sink")).toContain(
    '"callee":"%class.bagPrototype:Sink"',
  );
  expect(fns.get("%class.bagPrototype:Sink")).toContain('"className":"Late"');
});
