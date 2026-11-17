import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

for (const [name, source] of [
  [
    "mixed",
    `class Menu { value=1; } type Source=Menu|number[]|(()=>number[]); function isMenu(value:Source):boolean{return value instanceof Menu;} console.log(isMenu(new Menu()),isMenu([]),isMenu(()=>[]));`,
  ],
  [
    "callable prototype",
    `class Menu { value=1; } function factory():number[]{return [];} function check(value:unknown):boolean{return value instanceof Menu;} console.log(check(factory)); Object.setPrototypeOf(factory,Menu.prototype); console.log(check(factory));`,
  ],
  [
    "custom hook",
    `class Menu { static [Symbol.hasInstance](value:unknown):boolean{return typeof value==="function";} } type Source=Menu|number[]|(()=>number[]); function check(value:Source):boolean{return value instanceof Menu;} console.log(check(()=>[]),check([]));`,
  ],
] as const) {
  test(`class instanceof supports ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-union-callable-instanceof-"));
    try {
      const entry = join(dir, "main.ts"),
        output = join(dir, "main.ir.json");
      writeFileSync(entry, source);
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      const module = deserializeModule(readFileSync(output, "utf8"));
      expect(validateModule(module)).toEqual([]);
      if (name !== "custom hook") {
        const helper = module.functions.find((fn) => fn.name === "%dyn.class.instanceof:Menu");
        expect(helper).toBeDefined();
        expect(JSON.stringify(helper)).toContain('"test":"function"');
        expect(JSON.stringify(helper)).toContain("%dyn.class.prototypeChainIdentity");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

for (const [name, source] of [
  [
    "generic target",
    `class Menu<T> { constructor(readonly value:T){} } type Source=Menu<number>|(()=>number); function check(value:Source):boolean{return value instanceof Menu;} console.log(check(new Menu(1)),check(()=>1));`,
  ],
  [
    "builtin target",
    `type Source=Error|(()=>number); function check(value:Source):boolean{return value instanceof Error;} console.log(check(new Error()),check(()=>1));`,
  ],
] as const) {
  test(`callable union retains ${name} prototype refusal`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-union-callable-refusal-"));
    try {
      const entry = join(dir, "main.ts");
      writeFileSync(entry, source);
      const result = await compile(entry, {
        outputKind: "ir",
        outDir: dir,
        outPath: join(dir, "main.ir.json"),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.diagnostics.some((d) => d.code === "SC1090")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
