import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

for (const [name, source] of [
  [
    "captured handler",
    `interface Info {key:string;} type Reply={type:"consume"}|{type:"ignored"};type Handler=((info:Info)=>Reply)|((info:Info)=>void); function wrap(handler:Handler|null){return (info:Info)=>handler?.(info);} function reply(_info:Info):Reply{return {type:"consume"};} const a=wrap(null);const b=wrap(reply);console.log(a?.({key:"x"}),b?.({key:"x"}));`,
  ],
  [
    "scalar results",
    `type Handler=((value:number)=>number)|((value:number)=>string);function call(handler:Handler|null){return handler?.(2);}function numberReply(x:number):number{return x+1;}function stringReply(x:number):string{return String(x);}console.log(call(null),call(numberReply),call(stringReply));`,
  ],
  [
    "skipped arguments",
    `type Handler=((value:number)=>number)|((value:number)=>void);let count=0;function arg(){return ++count;}function call(handler:Handler|null){return handler?.(arg());}function numberReply(x:number):number{return x;}call(null);console.log(count);call(numberReply);console.log(count);`,
  ],
  [
    "member receiver",
    `type Handler=((this:{value:number},x:number)=>number)|((this:{value:number},x:number)=>void);function run(holder:{value:number;handler:Handler|null}){return holder.handler?.(2);}console.log(run({value:3,handler:function(this:{value:number},x:number){return this.value+x;}}),run({value:3,handler:null}));`,
  ],
] as const) {
  test(`optional callable union ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-optional-callable-union-"));
    try {
      const entry = join(dir, "main.ts"),
        output = join(dir, "main.ir.json");
      writeFileSync(entry, source);
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      const module = deserializeModule(readFileSync(output, "utf8"));
      expect(validateModule(module)).toEqual([]);
      expect(JSON.stringify(module.functions)).toContain('"kind":"dynCall"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

for (const [name, source, code] of [
  [
    "joined callback result assignment",
    `type Handler=((x:number)=>number)|((x:number)=>void);function call(h:Handler|null){return h?.(1);}console.log(call((x:number)=>x));`,
    "SC2003",
  ],
  [
    "different parameter ABI",
    `type Handler=((x:number)=>number)|((x:number|undefined)=>string);function call(h:Handler|null){return h?.(1);}function value(x:number):number{return x;}console.log(call(value));`,
    "SC2001",
  ],
  [
    "spread arguments",
    `type Handler=((x:number)=>number)|((x:number)=>string);function call(h:Handler|null,args:[number]){return h?.(...args);}function value(x:number):number{return x;}console.log(call(value,[1]));`,
    "SC2001",
  ],
] as const) {
  test(`optional callable union retains ${name} refusal`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-optional-union-refusal-"));
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
      expect(result.diagnostics.some((d) => d.code === code)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
