import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

const row = `type Row={index:number;item:unknown}|{empty:true;label:string};interface Entry<T>{value:T;readonly update?:(value:T)=>void;}`;
for (const [name, parameters, arguments_, signature] of [
  ["sensitive first", "T,K", "Row,string", `proof(value:T):Omit<Entry<T>,"value">{return {};}`],
  ["sensitive last", "K,T", "string,Row", `proof(value:T):Omit<Entry<T>,"value">{return {};}`],
  [
    "skipped middle",
    "T,U,K",
    "Row,number,string",
    `proof(value:T,key:K):[Omit<Entry<T>,"value">,Omit<Entry<K>,"value">]{return [{},{}];}`,
  ],
] as const) {
  test(`generic class this retains ${name} checker binding`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-sensitive-this-"));
    try {
      const entry = join(dir, "main.ts"),
        outPath = join(dir, "main.ir.json");
      writeFileSync(
        entry,
        `${row}class Store<${parameters}>{#records=new Map<K,Entry<T>>();${signature}set(k:K,v:T){const old=this.#records.get(k);if(old){old.value=v;old.update?.(v);}else this.#records.set(k,{value:v});}get(k:K):T|undefined{return this.#records.get(k)?.value;}reset(){this.#records=new Map<K,Entry<T>>();}clear(){this.#records.clear();}}const c=new Store<${arguments_}>();c.set("x",{index:1,item:"ok"});c.set("x",{empty:true,label:"none"});console.log(c.get("x"));c.reset();c.clear();`,
      );
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      const mod = deserializeModule(readFileSync(outPath, "utf8"));
      expect(validateModule(mod)).toEqual([]);
      if (!mod.classes) throw new Error("missing class definitions");
      expect(mod.classes.filter((c) => c.name.startsWith("Store%"))).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
for (const order of [true, false]) {
  test(`generic class keeps ABI-equal conditional bindings distinct (${order})`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-sensitive-distinct-"));
    try {
      const entry = join(dir, "main.ts"),
        outPath = join(dir, "main.ir.json");
      const yes = `const yes=new Choice<"yes">(true);`,
        no = `const no=new Choice<"no">(false);`;
      writeFileSync(
        entry,
        `class Choice<K>{value:K extends "yes"?true:false;constructor(v:K extends "yes"?true:false){this.value=v;}read():K extends "yes"?true:false{return this.value;}}${order ? yes + no : no + yes}console.log(yes.read(),no.read());`,
      );
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      const mod = deserializeModule(readFileSync(outPath, "utf8"));
      expect(validateModule(mod)).toEqual([]);
      if (!mod.classes) throw new Error("missing class definitions");
      const classes = mod.classes.filter((c) => c.name.startsWith("Choice%"));
      expect(classes).toHaveLength(2);
      expect(new Set(classes.map((c) => c.name)).size).toBe(2);
      expect(classes.map((c) => c.fields.map((f) => f.type))).toEqual([
        [{ kind: "bool" }],
        [{ kind: "bool" }],
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
