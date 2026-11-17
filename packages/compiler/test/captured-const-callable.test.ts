import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

const accepted = [
  [
    "truthy immutable callback",
    `type Action=()=>void|Promise<void>;interface Item{action?:Action;run?:Action;}function finish(run:()=>unknown){return run();}function menu(item:Item){const run=item.action??item.run;return run?()=>finish(run):null;}const f=menu({action:()=>{console.log("called");}});f?.();`,
  ],
  [
    "nullable immutable callback",
    `function finish(run:()=>unknown){return run();}function menu(input:(()=>string)|null){const run=input;return run!==null?()=>finish(run):null;}console.log(menu(()=>"ok")?.());`,
  ],
  [
    "nested closure",
    `function finish(run:()=>unknown){return run();}function menu(input:(()=>number)|undefined){const run=input;return run?()=>()=>finish(run):null;}console.log(menu(()=>42)?.()());`,
  ],
] as const;
const existing = [
  [
    "mutable captured slot",
    `function finish(run:()=>unknown){return run();}function menu(input:(()=>number)|undefined){let run=input;const f=()=>finish(run!);run=undefined;return f;}menu(()=>42)();`,
  ],
  [
    "hidden array hole",
    `function finish(run:()=>unknown){return run();}function menu(input:Array<()=>number>){const run=input[5]!;return()=>finish(run);}menu([])();`,
  ],
] as const;
const refused = [
  [
    "mutable guarded capture",
    `function finish(run:()=>unknown){return run();}function menu(input:(()=>number)|undefined){let run=input;if(!run)return null;return()=>finish(run);}console.log(menu(()=>42)?.());`,
  ],
  [
    "multiple callable arms",
    `type Run=(()=>string)|(()=>number);function finish(run:()=>unknown){return run();}function menu(input:Run|undefined){const run=input;return run?()=>finish(run):null;}console.log(menu(()=>42)?.());`,
  ],
] as const;
for (const [expected, cases] of [
  [true, accepted],
  [true, existing],
  [false, refused],
] as const) {
  for (const [name, source] of cases) {
    test(`captured const callable ${name}`, async () => {
      const dir = mkdtempSync(join(tmpdir(), "scriptc-captured-callable-"));
      try {
        const entry = join(dir, "main.ts"),
          outPath = join(dir, "main.ir.json");
        writeFileSync(entry, source + "\nexport {};\n");
        const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath });
        expect(result.ok, JSON.stringify(result)).toBe(expected);
        if (result.ok)
          expect(validateModule(deserializeModule(readFileSync(outPath, "utf8")))).toEqual([]);
        else expect(result.diagnostics.some((d) => d.code === "SC2003")).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
}
