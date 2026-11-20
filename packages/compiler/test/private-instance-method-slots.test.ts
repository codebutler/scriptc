import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

const positives = [
  [
    "different private ABIs",
    `class Base{#offset(n:number):number{return n+1;}base(){return this.#offset(2);}}class Derived extends Base{#offset(s:string):string{return s+"!";}own(){return this.#offset("x");}}const d=new Derived();console.log(d.base(),d.own());`,
  ],
  [
    "fluent base and generic direct method",
    `class Base{position=0;#offset(axis:"x"|"y",n:number):this{this.position=n;return this;}place(n:number):this{return this.#offset("x",n);}}class Derived<K> extends Base{key:K;constructor(k:K){super();this.key=k;}#offset(index:number):number{return index*7;}locate(n:number){return this.#offset(n);}}const d=new Derived("x");console.log(d.place(3)===d,d.position,d.locate(2));`,
  ],
  [
    "method values",
    `class Base{#value=1;#offset(n:number,extra=1):number{return this.#value+n+extra;}value(){return this.#offset;}}class Derived extends Base{#value="own";#offset(s:string):string{return this.#value+s;}ownValue(){return this.#offset;}}const d=new Derived();const f=d.value(),g=d.ownValue();console.log(f.name,f.length,f===d.value(),g===d.ownValue(),f.call(d,2),g.bind(d,"!")());`,
  ],
  [
    "checked calls and values",
    `class Base{#value=1;#offset(n:number):number{return this.#value+n;}static call(v:unknown){return(v as Base).#offset(2);}static value(v:unknown){return(v as Base).#offset;}}class Derived extends Base{#offset(s:string):string{return s;}}const d=new Derived();console.log(Base.call(d),Base.value(d).call(d,3));`,
  ],
  [
    "private call ignores public prototype",
    `class Base{#offset():number{return 1;}static call(v:Base){return v.#offset();}}class Derived extends Base{#offset(n:number):number{return n+2;}static own(v:Derived){return v.#offset(3);}}const d=new Derived();Object.setPrototypeOf(d,{"#offset":()=>99});console.log(Base.call(d),Derived.own(d));`,
  ],
  [
    "baseline values without collision",
    `class C{#value=1;#offset(n:number,extra=1):number{return this.#value+n+extra;}value(){return this.#offset;}}const c=new C(),f=c.value();console.log(f.name,f.length,f===c.value(),f.call(c,2),f.bind(c,3)());`,
  ],
  [
    "baseline generic values without collision",
    `class C<T>{value:T;constructor(v:T){this.value=v;}#offset(n:number):number{return n+1;}method(){return this.#offset;}}const c=new C("x");console.log(c.method().call(c,2));`,
  ],
  [
    "own field initializers use own method brand",
    `class Base{#make():number{return 1;}first=this.#make();}class Derived extends Base{#make(s:string):string{return "own"+s;}second=this.#make("!");}const d=new Derived();console.log(d.first,d.second);`,
  ],
  [
    "formerly retained scalar method collision",
    `class Base{#x(){return 1;}base(){return this.#x();}}class Derived extends Base{#x(){return 2;}own(){return this.#x();}}console.log(new Derived().own());`,
  ],
  [
    "receiver and argument evaluate once",
    `class Base{#value=1;#offset(n:number){return this.#value+n;}static invoke(get:()=>Base,argument:()=>number){return get().#offset(argument());}}class Derived extends Base{#offset(s:string){return s;}}const d=new Derived();let receivers=0,args=0;console.log(Base.invoke(()=>{receivers++;return d;},()=>{args++;return 2;}),receivers,args);`,
  ],
  [
    "nongeneric extraction across generic intermediate",
    `class Base{#x(n:number){return n+1;}base(){return this.#x(2);}baseValue(){return this.#x;}}class Middle<T> extends Base{tag:T;constructor(tag:T){super();this.tag=tag;}}class Child extends Middle<string>{constructor(){super("middle");}#x(s:string){return this.tag+s;}own(){return this.#x("!");}ownValue(){return this.#x;}}const c=new Child();console.log(c.base(),c.own(),c.baseValue().call(c,3),c.ownValue().call(c,"?"),c.baseValue()===c.baseValue(),c.ownValue()===c.ownValue());`,
  ],
] as const;
for (const [name, source] of positives) {
  test(`private method slots ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-private-methods-"));
    try {
      const entry = join(dir, "main.ts"),
        outPath = join(dir, "main.ir.json");
      writeFileSync(entry, source);
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
      if (result.ok)
        expect(validateModule(deserializeModule(readFileSync(outPath, "utf8")))).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
for (const [name, source] of [
  [
    "own generic collision",
    `class Base{#offset(){return 1;}base(){return this.#offset();}}class Derived extends Base{#offset<T>(v:T):T{return v;}own(){return this.#offset(2);}}console.log(new Derived().own());`,
  ],
  [
    "accessor collision",
    `class Base{get #offset(){return 1;}base(){return this.#offset;}}class Derived extends Base{#offset(){return 2;}own(){return this.#offset();}}console.log(new Derived().own());`,
  ],
  [
    "local collision",
    `function make(){class Base{#offset(){return 1;}base(){return this.#offset();}}class Derived extends Base{#offset(){return 2;}own(){return this.#offset();}}return new Derived().own();}console.log(make());`,
  ],
  [
    "new generic method extraction",
    `class Base{#offset(){return 1;}base(){return this.#offset();}}class Derived<T> extends Base{#offset(n:number){return n+2;}value(){return this.#offset;}}console.log(new Derived<string>().value());`,
  ],
  [
    "method call before derived brand",
    `class Base{#make(){return 1;}constructor(){this.hook();}hook():unknown{return undefined;}}class Derived extends Base{#make(){return 2;}hook():unknown{return this.#make();}}new Derived();`,
  ],
  [
    "method value before derived brand",
    `class Base{#make(){return 1;}constructor(){this.hook();}hook():unknown{return undefined;}}class Derived extends Base{#make(){return 2;}hook():unknown{return this.#make;}}new Derived();`,
  ],
  [
    "method presence before derived brand",
    `class Base{#make(){return 1;}constructor(){this.hook();}hook():unknown{return undefined;}}class Derived extends Base{#make(){return 2;}hook():unknown{return #make in this;}}new Derived();`,
  ],
  [
    "baseline unknown private presence",
    `class C{#x(){return 1;}static has(value:unknown){return #x in (value as object);}}console.log(C.has({}));`,
  ],
] as const) {
  test(`private method slots retain ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-private-methods-negative-"));
    try {
      const entry = join(dir, "main.ts");
      writeFileSync(entry, source);
      const result = await compile(entry, {
        outputKind: "ir",
        outDir: dir,
        outPath: join(dir, "main.ir.json"),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.diagnostics.map((d) => d.code)).toContain("SC1090");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

for (const mode of ["call", "value"] as const) {
  test(`private method refused body ${mode}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-private-method-refused-"));
    try {
      const entry = join(dir, "main.ts");
      writeFileSync(
        entry,
        `class Base{#offset(){return 1;}base(){return this.#offset();}}class Derived extends Base{#offset():number{return Object.entries({set x(value:number){void value;}}).length;}own(){return this.#offset${mode === "call" ? "()" : ""};}}console.log(new Derived().own());`,
      );
      const result = await compile(entry, {
        outputKind: "ir",
        outDir: dir,
        outPath: join(dir, "main.ir.json"),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.diagnostics.some(
            (d) =>
              d.code === "SC1090" &&
              d.message.includes("Object.entries") &&
              d.message.includes("accessor"),
          ),
          JSON.stringify(result.diagnostics),
        ).toBe(true);
        expect(result.diagnostics.map((d) => d.code)).not.toContain("SC9001");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
