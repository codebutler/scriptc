import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

const prefix = `type Sink=(value:number)=>void;
interface Options { readonly command:(value:number)=>number; readonly event?:Sink; }
class Controller { readonly events=new Set<Sink>(); constructor(options:Options){BODY} command(value:number):number{return value;} }
const sink:Sink=()=>{};const controller=new Controller({command:n=>n,event:sink});console.log(controller.events.has(sink));`;
for (const [name, body] of [
  [
    "set",
    `if(options.event){this.events.add(options.event);this.events.has(options.event);this.events.delete(options.event);}`,
  ],
  [
    "map",
    `const map=new Map<Sink,number>();if(options.event){map.set(options.event,1);console.log(map.get(options.event),map.has(options.event),map.delete(options.event));}`,
  ],
  [
    "captured",
    `if(options.event){const add=()=>{if(options.event)this.events.add(options.event);};add();}`,
  ],
] as const) {
  test(`function collection keys ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-function-key-"));
    try {
      const entry = join(dir, "main.ts"),
        outPath = join(dir, "main.ir.json");
      writeFileSync(entry, prefix.replace("BODY", body));
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      const mod = deserializeModule(readFileSync(outPath, "utf8"));
      expect(validateModule(mod)).toEqual([]);
      expect(JSON.stringify(mod.functions)).toContain('"fn":"dyn.functionKey"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

for (const [name, source] of [
  [
    "explicit unknown assertion",
    `type Sink=(value:number)=>void;const raw:unknown=(value:number)=>{};const set=new Set<Sink>();set.add(raw as Sink);`,
  ],
  [
    "structural record copy",
    `interface A{a:number;}interface B{a:number;b:number;}const b:B={a:1,b:2};const set=new Set<A>();set.add(b as A);`,
  ],
] as const) {
  test(`function key retains ${name} refusal`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-function-key-negative-"));
    try {
      const entry = join(dir, "main.ts");
      writeFileSync(entry, source);
      const result = await compile(entry, {
        outputKind: "ir",
        outDir: dir,
        outPath: join(dir, "main.ir.json"),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.diagnostics.map((d) => d.code)).toContain("SC2020");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
