import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

for (const [name, spread, accepted] of [
  ["present or empty", "...(min !== undefined ? { min } : {})", true],
  ["and", "...(min !== undefined && { min })", true],
  ["two partial arms", "...(min !== undefined ? { min } : { max: 10 })", false],
  ["nested", "...(min !== undefined ? (min > 0 ? { min } : { max: 10 }) : {})", false],
] as const) {
  test(`conditional union spread checks the completed object: ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-conditional-union-spread-"));
    try {
      const entry = join(dir, "main.ts"),
        output = join(dir, "main.ir.json");
      writeFileSync(
        entry,
        `type Axis = {mode:"fixed";size:number;min?:number;max?:number} | {mode:"hug";min?:number;max?:number};
function bounded(value:Axis,min:number|undefined):Axis{return {...value,${spread}};}
console.log(JSON.stringify(bounded({mode:"fixed",size:10},0)),JSON.stringify(bounded({mode:"hug"},undefined)));
export {};`,
      );
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
      expect(result.ok, JSON.stringify(result)).toBe(accepted);
      if (!result.ok) {
        expect(
          result.diagnostics?.some(
            (diagnostic) =>
              diagnostic.code === "SC1090" && diagnostic.message.includes("conditional spreads"),
          ),
        ).toBe(true);
        return;
      }
      const module = deserializeModule(readFileSync(output, "utf8"));
      expect(validateModule(module)).toEqual([]);
      const body = JSON.stringify(module.functions.find((fn) => fn.name === "bounded")?.body);
      expect(body).toContain('"fn":"dyn.copyDataProperties"');
      expect(body).toContain('"kind":"dynCheck"');
      expect(body).not.toContain("%union.strand.");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
