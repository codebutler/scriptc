import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";
import { KeyOrderNotes } from "../src/frontend/lowering/key-order-witness.js";
import { mapExprChildren } from "../src/ir/traverse.js";
import type { IrExpr } from "../src/ir/ir.js";

const cases = [
  [
    "live-values",
    'let selected=1;const events:string[]=[];const assets={first:0,get chosen():number{events.push("get");return selected;},last:2};selected=7;console.log(JSON.stringify(Object.entries(assets)),events.join(","));export {};\n',
    true,
  ],
  [
    "mutates-later",
    'const events:string[]=[];const value={get first():number{events.push("first");value.last=9;return 1;},last:2};console.log(JSON.stringify(Object.entries(value)),events.join(","));export {};\n',
    true,
  ],
  [
    "identity",
    "const shared=[1,2];const value={first:shared,get second():number[]{return shared;}};const entries=Object.entries(value);console.log(entries[0]![1]===shared,entries[1]![1]===shared,entries[0]![1]===entries[1]![1]);export {};\n",
    true,
  ],
  [
    "keys-and-throw",
    'let calls=0;const sentinel={x:1};const value={a:1,get b():number{calls++;throw sentinel;},c:3};console.log(Object.keys(value).join(","),calls);try{Object.values(value);}catch(error){console.log(error===sentinel,calls);}export {};\n',
    true,
  ],
  [
    "after-await",
    "let selected=1;const value={a:0,get b():number{return selected;},c:2};async function run():Promise<void>{await Promise.resolve();selected=5;console.log(JSON.stringify(Object.entries(value)));}void run();export {};\n",
    true,
  ],
  [
    "numeric-order",
    'const value={z:9,get "12"():number{return 12;},"2":2,get a():number{return 1;}};console.log(JSON.stringify(Object.entries(value)));export {};\n',
    true,
  ],
  [
    "get-and-set",
    "let selected=1;let calls=0;const value={first:0,get choice():number{calls++;return selected;},set choice(v:number){selected=v;},last:2};value.choice=7;console.log(JSON.stringify(Object.entries(value)),calls);export {};",
    true,
  ],
  [
    "reversed-producers",
    'const first={x:1,get y():number{return 2;}};const second={get y():number{return 3;},x:4};console.log(Object.keys(first).join(","),Object.keys(second).join(","));export {};\n',
    false,
  ],
  [
    "setter-only",
    "let stored=0;const value={a:1,set b(v:number){stored=v;},c:2};console.log(JSON.stringify(Object.entries(value)),stored);export {};\n",
    false,
  ],
  [
    "dynamic-exposure",
    "const value={first:1,get second():number{return 2;}};const boxed:unknown=value;console.log(boxed,Object.keys(value));export {};",
    false,
  ],
  [
    "dynamic-producer",
    'const value={first:1,get second():number{return 2;}};const parsed=JSON.parse("{}") as typeof value;console.log(Object.keys(parsed));export {};',
    false,
  ],
] as const;
const allCases = [
  ...cases,
  [
    "NUL-delimited names retain distinct orders",
    'const a={"":1,get "\\0"():number{return 2;}};const b={get "\\0"():number{return 3;},"":4};console.log(JSON.stringify(Object.keys(a)),JSON.stringify(Object.keys(b)));export {};\n',
    false,
  ],
] as const;

for (const [name, source, supported] of allCases) {
  test(`accessor enumeration: ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-accessor-enum-"));
    try {
      const entry = join(dir, "main.ts"),
        output = join(dir, "main.ir.json");
      writeFileSync(entry, source);
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
      expect(result.ok, JSON.stringify(result)).toBe(supported);
      if (result.ok) {
        const module = deserializeModule(readFileSync(output, "utf8"));
        expect(validateModule(module)).toEqual([]);
        const helpers = module.functions.filter((fn) => fn.name.startsWith("%obj.accessor."));
        expect(helpers.length).toBeGreaterThan(0);
        for (const fn of helpers) {
          const body = JSON.stringify(fn.body);
          expect(body).not.toContain('"kind":"dynFrom"');
          if (fn.name.startsWith("%obj.accessor.keys"))
            expect(body).not.toContain('"kind":"callValue"');
        }
      } else {
        expect(result.diagnostics.some((d) => d.code === "SC1090")).toBe(true);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("accessor order requests survive an ordinary call rebuild", () => {
  const notes = new KeyOrderNotes();
  const loc = { file: "test.ts", start: 0, end: 1 };
  const call: IrExpr = {
    kind: "call",
    callee: "%obj.accessor.keys.test",
    args: [],
    type: { kind: "array", elem: { kind: "string" } },
    loc,
  };
  notes.accessorEnumeration(call, "accessor-shape");
  const rebuilt = mapExprChildren(
    call,
    (expr) => expr,
    (stmt) => stmt,
  );
  expect(rebuilt).not.toBe(call);
  expect(notes.accessorEnumerationOf(rebuilt)).toBe("accessor-shape");
});
