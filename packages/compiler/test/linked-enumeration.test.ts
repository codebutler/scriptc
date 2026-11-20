import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { compile, deserializeModule, validateModule } from "../src/index.js";
import { everyStmtList } from "../src/ir/traverse.js";

test("enumeration emits only the direct links of each receiver shape", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scriptc-linked-enumeration-"));
  try {
    const entry = fileURLToPath(
      new URL("../../../tests/corpus/linked-record-enumeration.ts", import.meta.url),
    );
    const outPath = join(dir, "main.ir.json");
    const result = await compile(entry, { outDir: dir, outPath, outputKind: "ir" });
    if (!result.ok) throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
    const mod = deserializeModule(await readFile(outPath, "utf8"));
    const link = mod.recordLinks?.[0];
    if (!link) throw new Error("expected a record link");
    const invalid = {
      ...mod,
      recordLinks: [...(mod.recordLinks ?? []), { ...link, compose: "%missing" }],
    };
    const errors = validateModule(invalid).map((error) => error.message);
    expect(errors).toContain(`duplicate record link pair ${link.pair}`);
    expect(errors).toContain(`record link ${link.pair} has no compose function "%missing"`);
    const helpers = mod.functions.filter((fn) => /^%obj\.(entries|values)\./.test(fn.name));
    expect(helpers.length).toBeGreaterThan(0);
    for (const fn of helpers) {
      const receiver = fn.params[0]?.type;
      if (receiver?.kind !== "record") throw new Error("expected a record parameter");
      const incoming = (mod.recordLinks ?? []).filter((link) => link.to === receiver.shapeId);
      let tests = 0;
      everyStmtList(fn.body, {
        stmt: () => true,
        expr: (expr) => {
          if (expr.kind === "libCall" && expr.fn === "record.linkIs") tests++;
          return true;
        },
      });
      expect(tests, fn.name).toBe(incoming.length);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
