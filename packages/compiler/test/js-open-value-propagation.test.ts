import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile, deserializeModule, validateModule } from "../src/index.js";

async function moduleOf(source: string, extension = "mjs") {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-open-js-value-"));
  try {
    const entry = join(dir, `main.${extension}`);
    writeFileSync(entry, source);
    const result = await compile(entry, {
      outputKind: "ir",
      outDir: dir,
      outPath: join(dir, "out.ir.json"),
    });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const module = deserializeModule(readFileSync(join(dir, "out.ir.json"), "utf8"));
    expect(validateModule(module)).toEqual([]);
    return module;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("open JS method results propagate through bindings and forwarded returns", async () => {
  const module = await moduleOf(`
function generate(decorator) { let handlers={result(){return "old";}}; handlers=decorator(handlers); return handlers.result(); }
function forward(){const result=generate(()=>({result(){return [1,2];}}));return result;}
console.log(forward());`);
  expect(module.functions.find((f) => f.name === "generate")?.returnType.kind).toBe("dyn");
  expect(module.functions.find((f) => f.name === "forward")?.returnType.kind).toBe("dyn");
  expect(module.functions.some((f) => f.name.startsWith("%dyn.class.protocol.fallback"))).toBe(
    false,
  );
});

test("recursive JS returns retain open-value evidence in either query order", async () => {
  const module = await moduleOf(`
function first(n){if(n)return second(n-1);const value={kind:false};value.kind="node";return value.kind;}
function second(n){return first(n);}
console.log(second(1),first(1));`);
  for (const name of ["first", "second"])
    expect(module.functions.find((f) => f.name === name)?.returnType.kind).toBe("dyn");
});

test("explicit JavaScript return and binding contracts stay typed", async () => {
  const module = await moduleOf(`
/** @returns {string} */ function fixed(){return "fixed";}
/** @type {{result():string}} */ let handlers={result(){return "typed";}};
function typed(){return handlers.result();}
console.log(fixed(),typed());`);
  for (const name of ["fixed", "typed"])
    expect(module.functions.find((f) => f.name === name)?.returnType.kind).toBe("string");
});

test("TypeScript protocol results keep their declared signature", async () => {
  const module = await moduleOf(
    `
interface Value { result(): string; }
class Box implements Value { result():string{return "typed";} }
function read(value:Value):string{return value.result();}
console.log(read(new Box()));`,
    "ts",
  );
  expect(module.functions.find((f) => f.name === "read")?.returnType.kind).toBe("string");
});

test("an open sibling does not erase a property's JSDoc contract", async () => {
  const module = await moduleOf(`
function read(){const value={/** @type {boolean} */ fixed:false,kind:false};value.kind="node";return value.fixed;}
function bracket(){const value={/** @type {boolean} */ fixed:false,kind:false};value.kind="node";return value["fixed"];}
console.log(read(),bracket());`);
  for (const name of ["read", "bracket"])
    expect(module.functions.find((f) => f.name === name)?.returnType.kind).toBe("bool");
});

test("an open receiver does not erase an explicitly typed method result", async () => {
  const module = await moduleOf(`
function read(replace){let value={/** @returns {string} */ result(){return "typed";}};value=replace(value);return value.result();}
console.log(read(x=>x));`);
  expect(module.functions.find((f) => f.name === "read")?.returnType.kind).toBe("string");
  expect(module.functions.find((f) => f.name === "read")?.body).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "return",
        value: expect.objectContaining({ kind: "dynCheck", type: { kind: "string" } }),
      }),
    ]),
  );
});
