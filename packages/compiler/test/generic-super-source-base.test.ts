import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

for (const mode of ["native", "observed", "literal", "census"] as const) {
  test(`generic super uses its source base: ${mode}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-generic-super-"));
    const call = mode === "literal" ? 'super["scroll"](value)' : "super.scroll(value)";
    const observation =
      mode === "observed" || mode === "literal"
        ? "console.log(typeof Base.prototype.scroll);"
        : mode === "census"
          ? "function write<T,K extends keyof T>(target:T,key:K,value:T[K]){target[key]=value;} console.log(typeof write);"
          : "";
    try {
      const entry = join(dir, "main.ts"),
        output = join(dir, "main.ir.json");
      writeFileSync(
        entry,
        `class Base { total=0; scroll(value:number):this {this.total+=value;return this;} }
class Child<T> extends Base {constructor(readonly item:T){super();} override scroll(value:number):this{return ${call};}}
class Deeper extends Child<string>{extra=42;constructor(){super("deeper");}}
${observation}
console.log(new Child("first").scroll(2).item,new Child(3).scroll(4).item,new Deeper().scroll(5).extra);
export {};`,
      );
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      if (!result.ok) return;
      const module = deserializeModule(readFileSync(output, "utf8"));
      expect(validateModule(module)).toEqual([]);
      const bodies = module.functions.filter(
        (fn) => fn.name.startsWith("%Child%") && fn.name.endsWith(".scroll"),
      );
      expect(bodies.length).toBeGreaterThan(0);
      for (const fn of bodies) {
        const body = JSON.stringify(fn.body);
        if (mode === "native") expect(body).toContain('"callee":"%Base.scroll"');
        else {
          expect(body).toContain("%prototype.data.Base");
          expect(body).toContain("%dyn.class.computed.");
          expect(body).toContain("%class.assert.");
          expect(body).toContain('"kind":"dynCall"');
          expect(fn.locals.some((local) => local.name === "%superReceiver")).toBe(true);
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
