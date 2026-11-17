import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

for (const [name, source] of [
  [
    "conditional captured callback",
    `type H=((x:number)=>number)|((x:number)=>void);function wrap(h:((x:number)=>number|undefined)|null):H|null{return h && (x=>h(x));}console.log(wrap(null),wrap(x=>x)?.(2));`,
  ],
  [
    "both nullish arms",
    `type H=((x:number)=>number)|((x:number)=>void);function wrap(h:((x:number)=>number|undefined)|null|undefined):H|null|undefined{return h;}console.log(wrap(null),wrap(undefined),wrap(x=>x)?.(2));`,
  ],
  [
    "existing scalar callback route",
    `type H=((x:number)=>number)|((x:number)=>void);type S=((x:number)=>boolean)|((x:number)=>string)|null;function bridge(x:S):H|null{return x;}console.log(bridge(null));`,
  ],
  [
    "existing multiple source functions",
    `type H=((x:number)=>number)|((x:number)=>void);type S=((x:number)=>boolean)|((x:number)=>void)|null;function bridge(x:S):H|null{return x;}function yes(x:number):boolean{return x>0;}console.log(bridge(yes)?.(1),bridge(null));`,
  ],
  [
    "record argument",
    `interface Info{n:number;}type R={kind:"ok"}|{kind:"skip"};type H=((x:Info)=>R)|((x:Info)=>void);function wrap(h:((x:Info)=>R|undefined)|null):H|null{return h;}const f=wrap(x=>{x.n++;return {kind:"ok"};});console.log(f?.({n:1}));`,
  ],
] as const) {
  test(`nullable callback retag ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-nullable-retag-"));
    try {
      const entry = join(dir, "main.ts"),
        outPath = join(dir, "main.ir.json");
      writeFileSync(entry, source);
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      const module = deserializeModule(readFileSync(outPath, "utf8"));
      expect(validateModule(module)).toEqual([]);
      const helpers = module.functions.filter((fn) => fn.name.startsWith("%union.callable"));
      if (name.startsWith("existing ")) {
        expect(helpers).toEqual([]);
        return;
      }
      expect(helpers.length).toBeGreaterThan(0);
      for (const helper of helpers) {
        expect(helper.params).toHaveLength(1);
        const source = helper.params[0]!.type;
        expect(source.kind).toBe("union");
        if (source.kind !== "union") continue;
        const arms = module.unions?.find((u) => u.id === source.unionId)?.arms ?? [];
        expect(arms.filter((arm) => arm.kind === "func")).toHaveLength(1);
        expect(
          arms.every(
            (arm) => arm.kind === "func" || arm.kind === "undefinedT" || arm.kind === "nullT",
          ),
        ).toBe(true);
        expect(JSON.stringify(helper.body)).toContain('"kind":"unionIsTag"');
        expect(JSON.stringify(helper.body)).toContain('"kind":"dynCheck"');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

for (const [name, source] of [
  [
    "rest source",
    `type H=((x:number)=>number)|((x:number)=>void);type S=((x:number,...rest:number[])=>number|undefined)|null;function bridge(x:S):H|null{return x;}console.log(bridge(null));`,
  ],
] as const) {
  test(`nullable callback retag retains ${name} refusal`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-nullable-retag-negative-"));
    try {
      const entry = join(dir, "main.ts");
      writeFileSync(entry, source);
      const result = await compile(entry, {
        outputKind: "ir",
        outDir: dir,
        outPath: join(dir, "main.ir.json"),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.diagnostics.map((d) => d.code)).toContain("SC2003");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
