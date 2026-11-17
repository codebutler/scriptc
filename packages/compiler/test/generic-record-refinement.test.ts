import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { compile } from "../src/index.js";
import { loadProgram } from "../src/frontend/program-node.js";
import * as ts from "../src/frontend/ts7/adapter.js";
import {
  mapType,
  noteScopeSensitiveMapping,
  ShapeRegistry,
  UnionRegistry,
  type TypeMapperCtx,
} from "../src/frontend/type-mapper.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";
import type { IrType } from "../src/ir/ir.js";

const stroke = `interface Stroke{readonly kind:"up"|"down";readonly key:string;readonly code:string;readonly repeat?:boolean;}interface Full extends Stroke{readonly repeat:boolean;readonly alt:boolean;readonly composing:boolean;readonly ctrl:boolean;readonly inLocalControl:boolean;readonly inText:boolean;readonly keyCode:number;readonly location:number;readonly meta:boolean;readonly shift:boolean;}const input:Full={kind:"down",key:"A",code:"KeyA",repeat:true,alt:true,composing:false,ctrl:true,inLocalControl:false,inText:true,keyCode:65,location:1,meta:false,shift:true};`;
const observe = `console.log(JSON.stringify(result),result.ctrl,result.alt,result.shift,result.keyCode,result.inText,result===input,input.kind,input.repeat);`;
const held = `interface HeldKeys<F,S extends Stroke>{note(sample:S,from:F):void;release():{sample:S;from:F}[];}`;
const programs: [string, string][] = [
  [
    "direct clone baseline",
    `${stroke}function clone<S extends Stroke>(sample:S):S{return {...sample};}const result=clone<Full>(input);${observe}`,
  ],
  [
    "direct override",
    `${stroke}function release<S extends Stroke>(sample:S){return {...sample,kind:"up" as const,repeat:false};}const result=release<Full>(input);${observe}`,
  ],
];
for (const [name, named, annotated] of [
  ["inline", false, true],
  ["inline inferred", false, false],
  ["named", true, true],
] as const) {
  const callback = `({sample,from})=>({sample:{...sample,kind:"up" as const,repeat:false},from})`;
  const declaration = named
    ? `const asRelease=({sample,from}:{sample:S;from:F})=>({sample:{...sample,kind:"up" as const,repeat:false},from});`
    : "";
  programs.push([
    `returned object ${name}`,
    `${stroke}${held}function createHeldKeys<F,S extends Stroke>()${annotated ? ":HeldKeys<F,S>" : ""}{const held=new Map<string,{sample:S;from:F}>();${declaration}return{note(sample:S,from:F){const id=sample.code||sample.key;if(sample.kind==="up")held.delete(id);else if(!held.has(id))held.set(id,{sample,from});},release(){const out=[...held.values()].map(${named ? "asRelease" : callback});held.clear();return out;}};}const held=createHeldKeys<number,Full>();held.note(input,7);const released=held.release();const first=released[0];if(first===undefined)throw new Error("missing release");const result=first.sample;console.log(first.from,held.release().length);${observe}`,
  ]);
}
for (const [name, source] of programs)
  test(`generic record refinement ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-record-refinement-"));
    try {
      const entry = join(dir, "main.ts"),
        outPath = join(dir, "main.ir.json");
      writeFileSync(entry, source);
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      const mod = deserializeModule(readFileSync(outPath, "utf8"));
      expect(validateModule(mod)).toEqual([]);
      const shapes = mod.records?.filter(
        (shape) =>
          shape.fields.some((f) => f.name === "ctrl") &&
          shape.fields.some((f) => f.name === "shift"),
      );
      expect(shapes).toHaveLength(1);
      expect(shapes?.[0]?.fields.length).toBe(13);
      if (name === "direct override") {
        const fn = mod.functions.find((fn) => fn.name.startsWith("release%"));
        expect(fn?.returnType).toEqual(fn?.params[0]?.type);
        expect(JSON.stringify(fn?.body)).toContain('"kind":"recordClone"');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

let directory: string, load: ReturnType<typeof loadProgram>;
const aliases = new Map<string, ts.Type>();
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "scriptc-refinement-mapper-"));
  const entry = join(directory, "types.ts");
  writeFileSync(
    entry,
    `
export type Full={kind:"up"|"down";repeat:boolean;extra:{value:number}};
export type Down={kind:"down";repeat:boolean;extra:{value:number}};
export type Other={extra:{value:number};repeat:boolean;kind:"up"|"down"};
export type Optional={kind:"up"|"down";tag?:string;extra:number};
export type Required={kind:"up"|"down";tag:string|undefined;extra:number};
export type Indexed={kind:string;[key:string]:string};
export type Accessor={get kind():string;extra:number};
class Nominal{kind="down";extra=1;}export type Class=Nominal;
export type Unknown=object;
export type LiteralBoolean={repeat:true;extra:number};
export type ArrayField={kind:string;values:(string|undefined)[];extra:number};
export type FunctionField={kind:string;call:(value:string|undefined)=>void;extra:number};
export type RequiredOnly={tag:string|undefined};
export type Small={kind:string};
export type Refine<S extends {kind:string}>=S&{kind:"up"};
export type Both<S extends {kind:string}>=S&{kind:"up"}&{repeat:boolean};
export type NewField<S extends {kind:string}>=S&{newField:number};
export type Changed<S extends {kind:string}>=S&{kind:number};
export type OptionalRefine<S extends {kind:string}>=S&{tag?:string};
export type RequiredRefine<S extends {kind:string}>=S&{tag:string|undefined};
export type Two<S extends {kind:string},T extends {kind:string}>=S&T&{kind:"up"};
export type BooleanRefine<S extends {repeat:boolean}>=S&{repeat:false};
export type ArrayRefine<S extends {kind:string}>=S&{values:string[]};
export type FunctionRefine<S extends {kind:string}>=S&{call:(value?:string)=>void};
export type TagOptional<S extends {tag?:string}>=S&{tag?:string};
export type ClassCompanion<S extends {kind:string}>=S&Nominal;
`,
  );
  load = loadProgram(entry);
  ts.walkPreorder(load.entry, (node) => {
    if (ts.isTypeAliasDeclaration(node))
      aliases.set(node.name.text, load.program.getTypeChecker().getTypeAtLocation(node.type));
  });
});
afterAll(() => {
  load?.dispose();
  if (directory) rmSync(directory, { recursive: true, force: true });
});
function context(binding: string, checkerBinding = true) {
  const checker = load.program.getTypeChecker();
  const actual = aliases.get(binding);
  if (!actual) throw new Error("missing binding");
  const ctx: TypeMapperCtx = {
    checker,
    shapes: new ShapeRegistry(),
    unions: new UnionRegistry(),
    classNamer: (decl) => decl.name?.text ?? "anonymous",
    typeMemo: new Map(),
    isStdlibFile: (sf) => load.program.isSourceFileDefaultLibrary(sf),
    isNpmFile: () => false,
    isExternalTypeFile: () => false,
    isProgramFile: (sf) => load.moduleOrder.includes(sf),
  };
  const bound = mapType(actual, ctx);
  if (!bound) throw new Error("unmapped binding " + binding);
  ctx.typeMemo = new Map();
  ctx.resolveTypeParam = (type) => {
    if (!(type.flags & ts.TypeFlags.TypeParameter)) return null;
    noteScopeSensitiveMapping();
    return bound;
  };
  if (checkerBinding)
    ctx.resolveTypeParamTs = (type) => {
      if (!(type.flags & ts.TypeFlags.TypeParameter)) return null;
      noteScopeSensitiveMapping();
      return actual;
    };
  return { ctx, bound };
}
for (const binding of ["Full", "Other"])
  test(`refinement reuses ${binding} shape and metadata`, () => {
    const { ctx, bound } = context(binding);
    if (bound.kind !== "record") throw new Error("expected record");
    const before = JSON.stringify(ctx.shapes.get(bound.shapeId));
    expect(mapType(aliases.get("Both")!, ctx)).toEqual(bound);
    expect(JSON.stringify(ctx.shapes.get(bound.shapeId))).toBe(before);
  });
test("optional refinement preserves optional presence", () => {
  const { ctx, bound } = context("Optional");
  expect(mapType(aliases.get("OptionalRefine")!, ctx)).toEqual(bound);
});
for (const [name, binding, alias, checkerBinding] of [
  ["literal conflict", "Down", "Refine", true],
  ["boolean literal conflict", "LiteralBoolean", "BooleanRefine", true],
  ["array metadata refinement", "ArrayField", "ArrayRefine", true],
  ["callable refinement", "FunctionField", "FunctionRefine", true],
  ["changed representation", "Full", "Changed", true],
  ["new field", "Full", "NewField", true],
  ["optional becomes required", "Optional", "RequiredRefine", true],
  ["required becomes optional", "Required", "OptionalRefine", true],
  ["index signature", "Indexed", "Refine", true],
  ["accessor", "Accessor", "Refine", true],
  ["nominal class", "Class", "Refine", true],
  ["unknown binding", "Unknown", "Refine", true],
  ["missing checker binding", "Full", "Refine", false],
  ["multiple parameters", "Full", "Two", true],
] as const)
  test(`generic record refinement refuses ${name}`, () => {
    const { ctx } = context(binding, checkerBinding);
    expect(mapType(aliases.get(alias)!, ctx)).toBeNull();
  });

test("out-of-scope optionality keeps equal-constituent mapping", () => {
  const { ctx, bound } = context("RequiredOnly");
  expect(mapType(aliases.get("TagOptional")!, ctx)).toEqual(bound);
});
test("out-of-scope class companion keeps its existing refusal", () => {
  const { ctx } = context("Small");
  expect(mapType(aliases.get("ClassCompanion")!, ctx)).toBeNull();
});
for (const order of [
  ["Full", "Down"],
  ["Down", "Full"],
])
  test(`refinement literal binding memo order ${order.join("/")}`, () => {
    const shared = new Map<number, IrType>();
    for (const binding of order) {
      const { ctx, bound } = context(binding);
      const own = new Map<number, IrType>();
      ctx.typeMemoShared = shared;
      ctx.typeMemoFor = () => own;
      expect(mapType(aliases.get("Refine")!, ctx)).toEqual(binding === "Full" ? bound : null);
    }
  });
