import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

const cases = [
  [
    "generic-owner-record",
    true,
    `class Masks<TKey>{readonly #owner={restored:(source:string)=>{this.restored(source);}};readonly #sources=new Map<TKey,string>();constructor(){this.#owner.restored("ctor");}restored(source:string):void{console.log(source,this.#sources.size);}}new Masks<string>();`,
  ],
  [
    "record-constructor-after-brand",
    true,
    `class C{#owner={run:()=>this.#x};#x=1;constructor(){console.log(this.#owner.run());}}new C();`,
  ],
  [
    "record-stored-until-method",
    true,
    `class C{#owner={run:()=>this.#x};#x=1;run(){return this.#owner.run();}}console.log(new C().run());`,
  ],
  [
    "array-stored-until-method",
    true,
    `class C{#owner=[()=>this.#x];#x=1;run(){for(const run of this.#owner)console.log(run());}}new C().run();`,
  ],
  [
    "stored-then-invoked-early",
    false,
    `class C{#owner={run:()=>this.#x};#trigger=this.#owner.run();#x=1;read(){return this.#trigger;}}new C();`,
  ],
  [
    "factory-callback-early",
    false,
    `function invoke(run:()=>number):number{return run();}class C{#trigger=invoke(()=>this.#x);#x=1;read(){return this.#trigger;}}new C();`,
  ],
  [
    "record-factory-early",
    false,
    `function invoke(owner:{run:()=>number}):number{return owner.run();}class C{#trigger=invoke({run:()=>this.#x});#x=1;read(){return this.#trigger;}}new C();`,
  ],
  [
    "immediate-arrow-early",
    false,
    `class C{#trigger=(()=>this.#x)();#x=1;read(){return this.#trigger;}}new C();`,
  ],
  [
    "nested-private-literals",
    true,
    `class C{#owner={nested:[{run:()=>this.#x}]};#x=1;constructor(){for(const item of this.#owner.nested)console.log(item.run());}}new C();`,
  ],
  [
    "erased-literal-wrappers",
    true,
    `class C{#owner=(({run:()=>this.#x}) satisfies {run:()=>number});#x=1;constructor(){console.log(this.#owner.run());}}new C();`,
  ],
  [
    "plain-write-replaces-old-callbacks",
    true,
    `class C{#owner={run:()=>this.#x};#trigger=(this.#owner={run:()=>0});#x=1;read(){return this.#owner.run();}}console.log(new C().read());`,
  ],
  [
    "presence-does-not-read-callbacks",
    true,
    `class C{#owner={run:()=>this.#x};#seen=#owner in this;#x=1;read(){return this.#seen;}}console.log(new C().read());`,
  ],
  [
    "parenthesized-owner-read-early",
    false,
    `class C{#owner={run:()=>this.#x};#trigger=(this).#owner.run();#x=1;}new C();`,
  ],
  [
    "asserted-owner-read-early",
    false,
    `class C{#owner={run:()=>this.#x};#trigger=(this as C).#owner.run();#x=1;}new C();`,
  ],
  [
    "compound-owner-read-early",
    false,
    `class C{#owner={run:()=>this.#x};#trigger=(this.#owner ||= {run:()=>0});#x=1;}new C();`,
  ],
  [
    "aggregate-property-update-is-read",
    false,
    `class C{#owner={run:()=>this.#x,count:0};#trigger=++this.#owner.count;#x=1;}new C();`,
  ],
  [
    "getter-value-stays-eager",
    false,
    `class C{#owner={value:this.current};#x=1;get current(){return this.#x;}}new C();`,
  ],
  [
    "spread-literal-stays-conservative",
    false,
    `class C{#owner={...{run:()=>this.#x}};#x=1;read(){return this.#owner.run();}}new C();`,
  ],
  [
    "computed-key-stays-conservative",
    false,
    `class C{#owner={["run"]:()=>this.#x};#x=1;read(){return this.#owner.run();}}new C();`,
  ],
  [
    "computed-key-evaluation-stays-eager",
    false,
    `class C{#owner={[this.key()]:()=>0};#x=1;key(){return String(this.#x);}}new C();`,
  ],
  [
    "public-aggregate-keeps-conservative-policy",
    false,
    `class C{owner={run:()=>this.#x};#x=1;read(){return this.owner.run();}}new C();`,
  ],
  [
    "factory-inside-private-literal-stays-eager",
    false,
    `function invoke(run:()=>number):number{return run();}class C{#owner={value:invoke(()=>this.#x)};#x=1;read(){return this.#owner.value;}}new C();`,
  ],
] as const;
for (const [name, expected, source] of cases) {
  test(`private retained callbacks ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-private-retained-"));
    try {
      const entry = join(dir, "main.ts"),
        outPath = join(dir, "main.ir.json");
      writeFileSync(entry, source);
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(expected);
      if (result.ok)
        expect(validateModule(deserializeModule(readFileSync(outPath, "utf8")))).toEqual([]);
      else
        expect(
          result.diagnostics.some(
            (d) =>
              d.code === "SC1090" && d.message.includes("private instance fields accessed before"),
          ),
        ).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
