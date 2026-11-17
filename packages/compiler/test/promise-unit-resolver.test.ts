import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

for (const payload of ["void", "undefined"] as const) {
  for (const delayed of [false, true]) {
    test(`Promise<${payload}> accepts explicit undefined ${delayed ? "after a timer" : "directly"}`, async () => {
      const dir = mkdtempSync(join(tmpdir(), "scriptc-unit-resolver-"));
      try {
        const entry = join(dir, "main.ts"),
          output = join(dir, "main.ir.json");
        const settle = delayed ? "setTimeout(() => resolve(undefined), 1)" : "resolve(undefined)";
        writeFileSync(
          entry,
          `const p = new Promise<${payload}>(resolve => ${settle}); void p.then(() => console.log("done"));`,
        );
        const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
        expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
        if (!result.ok) return;
        expect(validateModule(deserializeModule(readFileSync(output, "utf8")))).toEqual([]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
}
