import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { everyStmtList } from "../src/ir/traverse.js";
import { validateModule } from "../src/ir/validate.js";

const positives = [
  [
    "distinct field slots",
    `class Base { #value=1; base(){return this.#value++;} } class Derived extends Base { #value="own"; own(){return this.#value;} } const d=new Derived();console.log(d.base(),d.own(),d.base());`,
  ],
  [
    "field and ancestor method",
    `class Base { #value(){return 7;} base(){return this.#value();} } class Derived extends Base { #value=3; own(){return ++this.#value;} } const d=new Derived();console.log(d.base(),d.own());`,
  ],
  [
    "callable field and ancestor method",
    `class Base { #value(){return 7;} base(){return this.#value();} } class Derived extends Base { #value=()=>3; own(){return this.#value();} } const d=new Derived();console.log(d.base(),d.own());`,
  ],
  [
    "constructor assignment and initialized field",
    `class Base { #value:number; constructor(n:number){this.#value=n;} base(){return this.#value;} } class Derived extends Base { #value:{n:number}; #closed=false; constructor(){super(1);this.#value={n:2};} own(){if(this.#closed)return 0;return this.#value.n;} } const d=new Derived();console.log(d.base(),d.own());`,
  ],
  [
    "generic existing private access",
    `class Box<T> { #value:T; constructor(v:T){this.#value=v;} read(other:Box<T>):T{return other.#value;} static read<T>(box:Box<T>):T{return box.#value;} } const n=new Box(2);const s=new Box("s");console.log(n.read(n),Box.read(n),s.read(s),Box.read(s));`,
  ],
  [
    "generic static cross specialization fields",
    `class Box<T> { #value:T; #call:(x:T)=>T; constructor(v:T){this.#value=v;this.#call=(x:T)=>x;} replace<U>(other:Box<U>,v:U):U{other.#value=v;return other.#call(other.#value);} static replace<T>(other:Box<T>,v:T):T{other.#value=v;return other.#call(other.#value);} } const n=new Box(1);const s=new Box("s");console.log(n.replace(s,"t"),s.replace(n,2),Box.replace(n,3),Box.replace(s,"u"));`,
  ],
  [
    "generic reverse construction order",
    `class Box<T> { #value:T; constructor(v:T){this.#value=v;} other<U>(box:Box<U>):U{return box.#value;} static write<T>(box:Box<T>,value:T):T{box.#value=value;return box.#value;} } const s=new Box("s");const n=new Box(1);console.log(s.other(n),n.other(s),Box.write(s,"t"),Box.write(n,2));`,
  ],
  [
    "base private helper remains lexical",
    `class Base {#x=1;constructor(){this.#helper();}#helper(){console.log(this.#x);}base(){return this.#x;}}class Derived extends Base{#x=2;#helper=()=>this.#x;own(){return this.#helper();}}const d=new Derived();console.log(d.base(),d.own());`,
  ],
  [
    "private objects after harmless base exposure",
    `function expose(value:object):void{console.log(typeof value);}class Base{constructor(){expose(this);}}class Derived extends Base{#x={n:2};own(){return this.#x.n;}}console.log(new Derived().own());`,
  ],
  [
    "checked ordinary brand",
    `class Base{#x=1;static read(value:unknown):unknown{return (value as Base).#x;}static write(value:unknown):void{(value as Base).#x=4;}base(){return this.#x;}}class Derived extends Base{#x="s";own(){return this.#x;}}const d=new Derived();console.log(Base.read(d));Base.write(d);console.log(d.base(),d.own());`,
  ],
  [
    "checked ordinary callable brand",
    `class Base{#callback=()=>7;static call(value:unknown):unknown{return (value as Base).#callback();}}class Derived extends Base{#callback=()=>"s";own(){return this.#callback();}}const d=new Derived();console.log(Base.call(d),d.own());`,
  ],
  [
    "effectful private callable receiver",
    `let receivers=0,args=0;class Base{#callback=(n:number)=>n;static run(value:Base){return receive(value).#callback(argument());}}function receive(value:Base):Base{receivers++;return value;}function argument():number{args++;return 3;}console.log(Base.run(new Base()),receivers,args);`,
  ],
  [
    "bare optional own constructor after brand",
    `class Base{#x=1;base(){return this.#x;}}class Derived extends Base{#x?:number;constructor(){super();this.hook();}hook(){console.log(this.#x);}}new Derived();`,
  ],
  [
    "bare dynamic own constructor after brand",
    `class C{#x:unknown;constructor(){this.hook();}hook(){console.log(this.#x);}}new C();`,
  ],
  [
    "bare optional before later initializer",
    `class C{#x?:number;value=this.hook();hook(){console.log(this.#x);return 1;}}console.log(new C().value);`,
  ],
  [
    "generic bare optional after brand",
    `class Base{constructor(){console.log("base");}}class Derived<T> extends Base{#x?:T;constructor(){super();this.hook();}hook(){console.log(this.#x);}}new Derived<number>();`,
  ],
  [
    "mixin harmless private exposure",
    `type Ctor<T=object>=new(...args:any[])=>T;function expose(value:object):void{console.log(typeof value);}class Base{constructor(){expose(this);}}function Mixed<T extends Ctor<Base>>(B:T){return class extends B{#x=2;read():number{return this.#x;}};}const Result=Mixed(Base);console.log(new Result().read());`,
  ],
  [
    "bare private own constructor write",
    `class C{#x?:number;constructor(){this.hook();}hook(){this.#x=3;}read(){return this.#x;}}console.log(new C().read());`,
  ],
  [
    "direct JS initializer read after declaration",
    `class C{#x=1;#y=this.#x;read(){return this.#y;}}console.log(new C().read());`,
  ],
  [
    "direct JS initializer write after declaration",
    `class C{#x=1;#y=(this.#x=3);read(){return this.#x+this.#y;}}console.log(new C().read());`,
  ],
  [
    "private presence after bare declaration",
    `class C{#x?:number;#seen=#x in this;read(){return this.#seen;}}console.log(new C().read());`,
  ],
  [
    "private presence remains lexical",
    `class Base{#x=1;constructor(){this.hook();}hook(){console.log(#x in this);}}class Derived extends Base{#x=2;own(){return #x in this;}}console.log(new Derived().own());`,
  ],
  [
    "private method presence before fields",
    `class C{#seen=#method in this;#method(){return 1;}read(){return this.#seen;}}console.log(new C().read());`,
  ],
  [
    "deferred initialization",
    `class Base { #value=1; base(){return this.#value;} } class Derived extends Base { #value!:number; constructor(){super();this.initialize();} initialize(){this.#value=5;} own(){return this.#value;} } const d=new Derived();console.log(d.base(),d.own());`,
  ],
] as const;
for (const [name, source] of positives) {
  test(`private instance slots ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-private-slots-"));
    try {
      const entry = join(dir, name.includes("direct JS") ? "main.js" : "main.ts"),
        outPath = join(dir, "main.ir.json");
      writeFileSync(entry, source);
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      const mod = deserializeModule(readFileSync(outPath, "utf8"));
      expect(validateModule(mod)).toEqual([]);
      if (!mod.classes) throw new Error("private-field fixture has no class definitions");
      if (name === "distinct field slots") {
        const base = mod.classes.find((cls) => cls.jsName === "Base");
        const derived = mod.classes.find((cls) => cls.jsName === "Derived");
        expect(base).toBeDefined();
        expect(derived).toBeDefined();
        if (!base || !derived) return;
        expect(base.fields).toHaveLength(1);
        expect(derived.fields.slice(0, base.fields.length)).toEqual(base.fields);
        expect(derived.fields).toHaveLength(2);
        const baseSlot = base.fields[0]!,
          ownSlot = derived.fields[1]!;
        expect(baseSlot.type.kind).toBe("f64");
        expect(ownSlot.type.kind).toBe("string");
        expect(baseSlot.name).not.toBe(ownSlot.name);
        for (const [method, owner, slot] of [
          ["base", base, baseSlot],
          ["own", derived, ownSlot],
        ] as const) {
          const fn = mod.functions.find((fn) => fn.name === `%${owner.name}.${method}`);
          expect(fn).toBeDefined();
          if (!fn) continue;
          let reads = 0,
            writes = 0;
          everyStmtList(fn.body, {
            expr: (expr) => {
              if (expr.kind === "fieldGet") {
                reads++;
                expect(expr.className).toBe(owner.name);
                expect(expr.field).toBe(slot.name);
                expect(expr.type).toEqual(slot.type);
              }
              return true;
            },
            stmt: (stmt) => {
              if (stmt.kind === "fieldSet") {
                writes++;
                expect(stmt.className).toBe(owner.name);
                expect(stmt.field).toBe(slot.name);
              }
              return true;
            },
          });
          expect(reads).toBeGreaterThan(0);
          if (method === "base") expect(writes).toBeGreaterThan(0);
        }
      }
      if (name === "effectful private callable receiver") {
        const fn = mod.functions.find((fn) => fn.name.endsWith("Base.static:run"));
        expect(fn).toBeDefined();
        if (fn) {
          let receivers = 0,
            args = 0,
            reads = 0;
          const declared = new Set(fn.params.map((param) => param.localId));
          everyStmtList(fn.body, {
            expr: (expr) => {
              if (expr.kind === "call") {
                if (expr.callee.endsWith("receive")) receivers++;
                if (expr.callee.endsWith("argument")) args++;
              }
              if (expr.kind === "fieldGet") reads++;
              return true;
            },
            stmt: (stmt) => {
              if (stmt.kind === "varDecl") declared.add(stmt.localId);
              return true;
            },
          });
          expect(receivers).toBe(1);
          expect(args).toBe(1);
          expect(reads).toBe(1);
          for (const local of fn.locals) expect(declared.has(local.id), local.id).toBe(true);
        }
      }
      for (const cls of mod.classes) {
        expect(new Set(cls.fields.map((f) => f.name)).size).toBe(cls.fields.length);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

for (const [name, source] of [
  [
    "accessor collision",
    `class Base{get #x(){return 1;} base(){return this.#x;}}class Derived extends Base{#x=2;own(){return this.#x;}}console.log(new Derived().own());`,
  ],
  [
    "generic collision",
    `class Base<T>{#x:T;constructor(x:T){this.#x=x;}base(){return this.#x;}}class Derived extends Base<number>{#x=2;own(){return this.#x;}}console.log(new Derived(1).own());`,
  ],
  [
    "generic collision through intermediate",
    `class Base<T>{#x:T;constructor(x:T){this.#x=x;}base(){return this.#x;}}class Middle extends Base<number>{}class Derived extends Middle{#x=2;own(){return this.#x;}}console.log(new Derived(1).own());`,
  ],
  [
    "renamed optional before brand",
    `class Base{#x=1;constructor(){this.hook();}hook(){}base(){return this.#x;}}class Derived extends Base{#other?:number;hook(){console.log(this.#other);}}new Derived();`,
  ],
  [
    "renamed dynamic before brand",
    `class Base{#x=1;constructor(){this.hook();}hook(){}base(){return this.#x;}}class Derived extends Base{#other:unknown=2;hook(){console.log(this.#other);}}new Derived();`,
  ],
  [
    "generic union callable field",
    `class Box<T>{#callback:()=>T;constructor(value:T){this.#callback=()=>value;}static call(value:Box<number>|Box<string>):unknown{return value.#callback();}}const n=new Box(1);const s=new Box("s");console.log(Box.call(n),Box.call(s));`,
  ],
  [
    "generic opaque callable field",
    `class Box<T>{#callback:()=>T;constructor(value:T){this.#callback=()=>value;}static call(value:any):unknown{return value.#callback();}}const b=new Box(1);console.log(Box.call(b));`,
  ],
  [
    "generic opaque read",
    `class Box<T>{#x:T;constructor(x:T){this.#x=x;}static read(value:any):unknown{return value.#x;}}const b=new Box(1);console.log(Box.read(b));`,
  ],
  [
    "generic opaque write",
    `class Box<T>{#x:T;constructor(x:T){this.#x=x;}static write(value:any):void{value.#x=2;}}const b=new Box(1);Box.write(b);`,
  ],
  [
    "generic union read number first",
    `class Box<T>{#x:T;constructor(x:T){this.#x=x;}static read(value:Box<number>|Box<string>):unknown{return value.#x;}}const n=new Box(1);const s=new Box("s");console.log(Box.read(n),Box.read(s));`,
  ],
  [
    "generic union read string first",
    `class Box<T>{#x:T;constructor(x:T){this.#x=x;}static read(value:Box<string>|Box<number>):unknown{return value.#x;}}const s=new Box("s");const n=new Box(1);console.log(Box.read(s),Box.read(n));`,
  ],
  [
    "generic union write",
    `class Box<T>{#x:T;constructor(x:T){this.#x=x;}static write(value:Box<number>|Box<string>):void{value.#x=2;}}const n=new Box(1);const s=new Box("s");Box.write(n);Box.write(s);`,
  ],
  [
    "local collision",
    `function make(){class Base{#x=1;base(){return this.#x;}}class Derived extends Base{#x=2;own(){return this.#x;}}return new Derived().own();}console.log(make());`,
  ],
  [
    "before optional private declaration brand",
    `class Base{#x=1;constructor(){this.hook();}hook(){}base(){return this.#x;}}class Derived extends Base{#x?:number;hook(){console.log(this.#x);}}new Derived();`,
  ],
  [
    "before dynamic private declaration brand",
    `class Base{#x=1;constructor(){this.hook();}hook(){}base(){return this.#x;}}class Derived extends Base{#x:unknown=2;hook(){console.log(this.#x);}}new Derived();`,
  ],
  [
    "before deferred private declaration brand",
    `class Base{#x=1;constructor(){this.hook();}hook(){}base(){return this.#x;}}class Derived extends Base{#x!:number;constructor(){super();this.#x=2;}hook(){console.log(this.#x);}}new Derived();`,
  ],
  [
    "generic specialized before optional brand",
    `class Base{constructor(){this.hook();}hook():void{}}class Derived<T> extends Base{#x?:T;hook():void{console.log(this.#x);}}new Derived<number>();`,
  ],
  [
    "mixin before optional brand",
    `type Ctor<T=object>=new(...args:any[])=>T;class Base{constructor(){this.hook();}hook():void{}}function Mixed<T extends Ctor<Base>>(B:T){return class extends B{#x?:number;hook():void{console.log(this.#x);}};}const Result=Mixed(Base);new Result();`,
  ],
  [
    "mixin before dynamic brand",
    `type Ctor<T=object>=new(...args:any[])=>T;class Base{constructor(){this.hook();}hook():void{}}function Mixed<T extends Ctor<Base>>(B:T){return class extends B{#x:unknown=2;hook():void{console.log(this.#x);}};}const Result=Mixed(Base);new Result();`,
  ],
  [
    "repeated private before brand write",
    `class Base{#x=1;constructor(){this.hook();}hook():void{}base(){return this.#x;}}class Derived extends Base{#x=2;hook():void{this.#x=3;}}new Derived();`,
  ],
  [
    "renamed private before brand write",
    `class Base{#x=1;constructor(){this.hook();}hook():void{}base(){return this.#x;}}class Derived extends Base{#other=2;hook():void{this.#other=3;}}new Derived();`,
  ],
  [
    "direct JS initializer read before declaration",
    `class C{#y=this.#x;#x=1;read(){return this.#y;}}new C();`,
  ],
  [
    "direct JS initializer write before declaration",
    `class C{#y=(this.#x=3);#x=1;read(){return this.#y;}}new C();`,
  ],
  [
    "private presence before declaration",
    `class Base{#x=1;constructor(){this.hook();}hook():void{}}class Derived extends Base{#x=2;hook():void{console.log(#x in this);}}new Derived();`,
  ],
  [
    "direct JS private presence before declaration",
    `class C{#seen=#x in this;#x=1;read(){return this.#seen;}}console.log(new C().read());`,
  ],
  [
    "parenthesized private before brand",
    `class Base{constructor(){this.hook();}hook():void{}}class Derived extends Base{#x=2;hook():void{console.log((this).#x);}}new Derived();`,
  ],
  [
    "asserted private before brand",
    `class Base{constructor(){this.hook();}hook():void{}}class Derived extends Base{#x=2;hook():void{(this as Derived).#x=3;}}new Derived();`,
  ],
  [
    "before private declaration brand",
    `class Base{#x=1;constructor(){this.hook();}hook(){}base(){return this.#x;}}class Derived extends Base{#x=2;hook(){console.log(this.#x);}}new Derived();`,
  ],
] as const) {
  test(`private instance slots retain ${name} refusal`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-private-slots-negative-"));
    try {
      const entry = join(dir, name.includes("direct JS") ? "main.js" : "main.ts");
      writeFileSync(entry, source);
      const result = await compile(entry, {
        outputKind: "ir",
        outDir: dir,
        outPath: join(dir, "main.ir.json"),
      });
      if (name === "direct JS private presence before declaration") {
        expect(result.ok).toBe(true);
        if (result.ok) {
          const mod = deserializeModule(readFileSync(join(dir, "main.ir.json"), "utf8"));
          expect(validateModule(mod)).toEqual([]);
          const fences: string[] = [];
          for (const fn of mod.functions)
            everyStmtList(fn.body, {
              expr: () => true,
              stmt: (stmt) => {
                if (stmt.kind === "runtimeFence" && stmt.code === "SC1090")
                  fences.push(stmt.message);
                return true;
              },
            });
          expect(
            fences.some((message) =>
              message.includes("private instance fields accessed before their declaration"),
            ),
          ).toBe(true);
        }
      } else {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.diagnostics.map((d) => d.code)).toContain("SC1090");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
