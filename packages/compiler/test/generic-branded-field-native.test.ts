import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";

test("generic class specializations retain symbol-branded fields in automatic mode", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-generic-branded-field-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(
      entry,
      `
const brand = Symbol("group");
interface Group { readonly [brand]: true }
function make(): Group { return { [brand]: true }; }
class Root<T> {
  readonly #group: Group = make();
  constructor(readonly value: T) {}
  group(): Group { return this.#group; }
}
const n = new Root(5);
const s = new Root("hi");
console.log(n.value, s.value, n.group() === n.group(), n.group() === s.group(), n.group()[brand]);
export {};
`,
    );
    const strict = await compile(entry, {
      outputKind: "ir",
      outDir: dir,
      outPath: join(dir, "program.ir.json"),
      tier: "static-only",
    });
    expect(strict.ok).toBe(false);
    if (!strict.ok)
      expect(strict.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "SC1090",
          message: expect.stringContaining("'Group'-typed class fields"),
        }),
      );
    const result = await compile(entry, {
      outDir: dir,
      outPath: join(dir, "program"),
      sanitize: process.env["SCRIPTC_SAN"] === "1",
    });
    expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
    if (!result.ok) return;
    const run = spawnSync(result.binaryPath, [], { encoding: "utf8", timeout: 30_000 });
    expect([run.status, run.signal, run.stdout, run.stderr]).toEqual([
      0,
      null,
      "5 hi true false true\n",
      "",
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
