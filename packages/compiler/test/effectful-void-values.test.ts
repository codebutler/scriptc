import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

for (const [name, source] of [
  [
    "union callback",
    `function effect(): void { console.log("effect"); }
const action: () => number | void = () => void effect(); console.log(action());`,
  ],
  [
    "assignment callback",
    `let state = "before";
const action: (value: string) => number | void = value => void (state = value);
console.log(action("after"), state);`,
  ],
  [
    "owned result",
    `function value(): { text: string } { console.log("once"); return { text: "owned" }; }
const result = { absent: void value() }; console.log(result.absent);`,
  ],
  [
    "short circuit",
    `let count = 0; function effect(): void { count++; }
const enabled = process.argv.length > 0;
const result = void (enabled && effect());
console.log(result, count);`,
  ],
] as const) {
  test(`explicit void preserves operand sequencing: ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-void-values-"));
    try {
      const entry = join(dir, "main.ts"),
        output = join(dir, "main.ir.json");
      writeFileSync(entry, source);
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      const module = deserializeModule(readFileSync(output, "utf8"));
      expect(validateModule(module)).toEqual([]);
      expect(
        module.functions.flatMap((fn) => fn.locals).filter((local) => local.type.kind === "void"),
      ).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
