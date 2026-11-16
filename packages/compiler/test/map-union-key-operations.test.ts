import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile, deserializeModule, validateModule } from "../src/index.js";

const positive = [
  [
    "keys",
    `type M = Map<number,number> | Map<number,{name:string}>;
function f(m:M) {for(const key of m.keys()) if(key===1)m.delete(key);}
f(new Map<number,number>([[1,2]]));`,
  ],
  [
    "queries and clear",
    `type M=Map<string,number>|Map<string,boolean>;
function f(m:M,key:string):boolean {const before=m.has(key);m.delete(key);m.clear();return before;}
console.log(f(new Map<string,number>([["a",1]]),"a"));`,
  ],
  [
    "reference keys",
    `type Key={id:number};type M=Map<Key,number>|Map<Key,string>;
function f(m:M,k:Key):boolean {return m.has(k)&&m.delete(k);}
const k={id:1};console.log(f(new Map<Key,number>([[k,1]]),k));`,
  ],
  [
    "readonly keys",
    `function f(m:ReadonlyMap<number,number>|ReadonlyMap<number,string>) {return [...m.keys()].join(",");}
console.log(f(new Map<number,number>([[1,2]])));`,
  ],
] as const;
const negative = [
  [
    "Error key snapshots",
    `function f(m:Map<Error,number>|Map<Error,string>) {return [...m.keys()];}
console.log(f(new Map<Error,number>([[new Error("key"),1]])));`,
  ],
  [
    "function keys",
    `type Key=()=>number; function f(m:Map<Key,number>|Map<Key,string>) {return [...m.keys()];}
console.log(f(new Map<Key,number>([[()=>1,1]])));`,
  ],
  [
    "different key layouts",
    `function f(m:Map<number,number>|Map<string,string>) {return [...m.keys()];}
console.log(f(new Map<number,number>([[1,2]])));`,
  ],
  [
    "non-map arm",
    `function f(m:Map<number,number>|Set<number>) {return [...m.keys()];}
console.log(f(new Map<number,number>([[1,2]])));`,
  ],
  [
    "value-reading operation",
    `function f(m:Map<number,number>|Map<number,string>) {return m.get(1);}
console.log(f(new Map<number,number>([[1,2]])));`,
  ],
] as const;

async function check(source: string, accepted: boolean) {
  const dir = await mkdtemp(join(tmpdir(), "scriptc-map-union-"));
  try {
    const entry = join(dir, "main.ts");
    const outPath = join(dir, "main.ir.json");
    await writeFile(entry, source);
    const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath });
    expect(result.ok, JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(accepted);
    if (result.ok) {
      const module = deserializeModule(await readFile(outPath, "utf8"));
      expect(validateModule(module)).toEqual([]);
      expect(JSON.stringify(module.functions)).toContain('"dynInvoke"');
    } else {
      expect(result.diagnostics.some((d) => d.code === "SC2020")).toBe(true);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
for (const [name, source] of positive)
  test(`Map union supports ${name}`, () => check(source, true));
for (const [name, source] of negative)
  test(`Map union retains refusal: ${name}`, () => check(source, false));
