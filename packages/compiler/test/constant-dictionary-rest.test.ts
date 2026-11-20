import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";

test.each(["key", 'key as "safe"', "options.key", '"toString"', '"__proto__"'])(
  "dictionary rest refuses the unproven or inherited exclusion %s",
  async (key) => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-record-rest-"));
    try {
      const entry = join(dir, "main.ts");
      writeFileSync(
        entry,
        `function read(input: Record<string, string>, key: string, options: {readonly key: "safe"}) {
  const { [${key}]: value, ...rest } = input;
  console.log(value, rest);
}
read({other:"v"}, "other", {get key() { return "safe" as const; }});
export {};`,
      );
      const built = await compile(entry, {
        outputKind: "ir",
        outDir: dir,
        outPath: join(dir, "out.ir.json"),
      });
      expect(built.ok ? [] : built.diagnostics.map((d) => d.code)).toContain("SC1031");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
