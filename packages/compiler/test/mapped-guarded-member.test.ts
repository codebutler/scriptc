import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

for (const [name, type, argument] of [
  ["mapped indexed member", "Partial<State[A]>", '"layout"'],
  ["readonly mapped indexed member", "Readonly<Partial<State[A]>>", '"layout"'],
  ["generic alias", "Change<A>", '"layout"'],
  ["direct type parameter", "A", "{x:number}"],
] as const) {
  test(`guarded missing member reads its mapped generic source: ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-mapped-member-"));
    try {
      const entry = join(dir, "main.ts"),
        output = join(dir, "main.ir.json");
      const parameter =
        name === "direct type parameter" ? "A extends object" : "A extends keyof State";
      writeFileSync(
        entry,
        `interface State {layout:{x:number};semantics:{selected:boolean};}
type Change<A extends keyof State>=Partial<State[A]>;
function read<${parameter}>(changes:${type}):unknown {if("selected" in changes)return changes.selected;return "absent";}
console.log(read<${argument}>({x:1}));
export {};`,
      );
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      if (!result.ok) return;
      const module = deserializeModule(readFileSync(output, "utf8"));
      expect(validateModule(module)).toEqual([]);
      const body = JSON.stringify(
        module.functions.filter((fn) => fn.name.startsWith("read%")).map((fn) => fn.body),
      );
      expect(body).toContain("%dyn.class.property.");
      expect(body).toContain('"kind":"dynFrom"');
      expect(body).not.toContain('"kind":"runtimeFence"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

for (const [name, operation, code] of [
  ["write", "changes.selected = 2;", "SC1090"],
  ["update", 'if (typeof changes.selected === "number") changes.selected++;', "SC1045"],
] as const) {
  test(`mapped generic missing-member ${name} remains refused`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-mapped-member-write-"));
    try {
      const entry = join(dir, "main.ts");
      writeFileSync(
        entry,
        `interface State {layout:{x:number};semantics:{selected:number};}
function change<A extends keyof State>(changes:Partial<State[A]>):void {if("selected" in changes){${operation}}}
change<"layout">({x:1});export {};`,
      );
      const result = await compile(entry, {
        outputKind: "ir",
        outDir: dir,
        outPath: join(dir, "main.ir.json"),
      });
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.diagnostics.some((diagnostic) => diagnostic.code === code)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
