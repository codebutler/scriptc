import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import type { IrExpr } from "../src/ir/ir.js";
import { everyStmtList } from "../src/ir/traverse.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

for (const [name, source] of [
  [
    "contextual value callback",
    `type Handler=((x:number)=>number)|((x:number)=>void);function call(h:Handler|null){return h?.(1);}console.log(call((x:number)=>x));`,
  ],
  [
    "returned captured callback",
    `interface Info{key:string;}type Reply={type:"consume"}|{type:"ignored"};type Handler=((x:Info)=>Reply)|((x:Info)=>void);function wrap(h:Handler|null):Handler|null{return info=>h?.(info);}function reply(x:Info):Reply{return {type:"consume"};}const h=wrap(reply);console.log(h?.({key:"x"}));`,
  ],
  [
    "undefined slot",
    `type Handler=((x:number)=>number)|((x:number)=>void);function call(h:Handler|undefined){return h?.(1);}console.log(call((x:number)=>x),call(undefined));`,
  ],
] as const) {
  test(`nullable callback assignment ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-nullable-callback-assignment-"));
    try {
      const entry = join(dir, "main.ts"),
        output = join(dir, "main.ir.json");
      writeFileSync(entry, source);
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      const module = deserializeModule(readFileSync(output, "utf8"));
      expect(validateModule(module)).toEqual([]);
      const bridges: IrExpr[] = [];
      for (const fn of module.functions) {
        everyStmtList(fn.body, {
          expr(node) {
            if (
              node.kind === "unionWrap" &&
              node.value.kind === "dynCheck" &&
              node.value.type.kind === "func" &&
              node.value.type.ret.kind === "void" &&
              node.value.value.kind === "dynFrom" &&
              node.value.value.value.type.kind === "func" &&
              node.value.value.value.type.ret.kind !== "void"
            )
              bridges.push(node);
            return true;
          },
          stmt: () => true,
        });
      }
      expect(bridges.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

for (const [name, source, code] of [
  [
    "no void arm",
    `type H=((x:number)=>number)|((x:number)=>string);function source(x:number):number|string{return x?x:"zero";}const h=source as H|null;console.log(h);`,
    "SC2003",
  ],
  [
    "different parameter ABI",
    `type H=((x:number)=>number)|((x:number|string)=>void);function source(x:number|string):number|undefined{return typeof x==="number"?x:undefined;}const h:H|null=source;console.log(h);`,
    "SC2003",
  ],
  [
    "typed rest source",
    `type H=((x:number)=>number)|((x:number)=>void);function source(x:number,...rest:number[]):number|undefined{return rest.length?x:undefined;}const h:H|null=source;console.log(h);`,
    "SC2003",
  ],
  [
    "direct void result serialization",
    `const raw:unknown=(x:number)=>x;const h=raw as (x:number)=>void;console.log(JSON.stringify(h(1)));`,
    "SC1090",
  ],
] as const) {
  test(`nullable callback assignment retains ${name} refusal`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-nullable-callback-refusal-"));
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
      expect(result.diagnostics.map((d) => d.code)).toContain(code);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
