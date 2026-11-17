import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

const declarations = `class Command { id=1; run():number{return this.id;} }
class Widget { id=2; paint():number{return this.id;} }
class Child extends Command { extra=3; }
type Part = Command|Widget|string|null;`;

for (const [name, body] of [
  [
    "set",
    `const set=new Set<Command>(); for(const part of parts) { if(part instanceof Command){set.add(part);console.log(set.has(part),set.delete(part));} }`,
  ],
  [
    "map",
    `const map=new Map<Command,number>(); for(const part of parts) { if(part instanceof Command){map.set(part,1);console.log(map.get(part),map.has(part),map.delete(part));} }`,
  ],
  [
    "captured",
    `const set=new Set<Command>(); for(const part of parts) { if(part instanceof Command){const later=()=>set.add(part);later();console.log(set.has(part));} }`,
  ],
  [
    "subclass",
    `const set=new Set<Command>(); for(const part of parts) { if(part instanceof Child){set.add(part);console.log(set.has(part));} }`,
  ],
  [
    "indexed-capture",
    `const set=new Set<Command>(); const part=parts[0]; if(part instanceof Command){const later=()=>part.run();set.add(part);console.log(later(),set.has(part));}`,
  ],
  [
    "indexed-map",
    `const map=new Map<Command,number>(); const part=parts[0]; if(part instanceof Command){const later=()=>part.run();map.set(part,later());console.log(map.get(part),map.delete(part));}`,
  ],
  [
    "else-chain",
    `const set=new Set<Command>(); for(const part of parts) { if(part===null)continue; if(part==="separator")console.log("separator");else if(part==="flexible")console.log("flexible");else if(typeof part==="string")continue;else if(part instanceof Command){set.add(part);console.log(set.has(part));} }`,
  ],
  [
    "live-capture",
    `const map=new Map<Command,number>(); const built:readonly unknown[]=["label",...parts];console.log(built.length);for(const part of parts) { if(part===null)continue; if(part==="separator")console.log("separator");else if(typeof part==="string")continue;else if(part instanceof Command){let button=map.get(part);if(!button){const later=()=>part.run();button=later();map.set(part,button);}console.log(map.has(part));} }`,
  ],
] as const) {
  test(`narrowed class union preserves ${name} key identity`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-narrowed-class-key-"));
    try {
      const entry = join(dir, "main.ts"),
        output = join(dir, "main.ir.json");
      writeFileSync(
        entry,
        `${declarations}\nfunction collect(parts:readonly Part[]):void {${body}}\ncollect([new Command(),new Child(),new Widget(),"skip",null]);`,
      );
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      const module = deserializeModule(readFileSync(output, "utf8"));
      expect(validateModule(module)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
