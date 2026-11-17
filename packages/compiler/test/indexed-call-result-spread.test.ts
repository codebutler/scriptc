import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { compile } from "../src/index.js";
import { Lowerer } from "../src/frontend/lowering/lowerer.js";
import type { Expression } from "../src/frontend/ts7/adapter.js";

test("checked indexed spreads copy later effects before validating declared fields", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-indexed-spread-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(
      entry,
      `
type Stacks = Readonly<Partial<Record<"body"|"mono",readonly string[]>>>;
const events:string[]=[];
function later():Readonly<Record<string,readonly string[]>> {
  events.push("later"); return {mono:["ok"]};
}
try {
  const result:Stacks={...JSON.parse('{"body":7}'),...later()};
  console.log("unexpected",result.body);
} catch(error) { console.log("checked",error instanceof TypeError,events.join(",")); }
const value=["original"];
const source:Readonly<Record<string,readonly string[]>>={body:value};
const recovered:Stacks={...source};
console.log("identity",recovered.body===value,recovered.body?.[0]);
`,
    );
    const result = await compile(entry, {
      outDir: dir,
      outPath: join(dir, "program"),
      sanitize: process.env["SCRIPTC_SAN"] === "1",
    });
    expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
    if (!result.ok) return;
    const child = spawnSync(result.binaryPath, [], { encoding: "utf8", timeout: 10000 });
    expect(child.status, child.stderr).toBe(0);
    expect(child.stdout).toBe("checked true later\nidentity true original\n");
    expect(
      child.stderr.replace(
        /^==\d+==WARNING: ASan doesn't fully support makecontext\/swapcontext functions and may produce false positives in some cases!\n/gm,
        "",
      ),
    ).toBe("");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 60000);

test("a checker-unmapped call supplies only its own lowered indexed spread witness", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-unmapped-spread-"));
  const original = Lowerer.prototype.lowerExpr;
  const proofs: { checkerUnmapped: boolean; indexed: boolean }[] = [];
  const spy = vi.spyOn(Lowerer.prototype, "lowerExpr").mockImplementation(function (
    this: Lowerer,
    node: Expression,
  ) {
    const candidate = node.getText().startsWith("Object.fromEntries(");
    const mapped = candidate ? this.mapTypeOf(this.typeOf(node)) : undefined;
    const result = original.call(this, node);
    if (candidate)
      proofs.push({
        checkerUnmapped: mapped === null,
        indexed:
          result.type.kind === "record" &&
          this.shapes.get(result.type.shapeId)?.indexValue !== undefined,
      });
    return result;
  });
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(
      entry,
      readFileSync(
        new URL("../../../tests/corpus/unmapped-call-result-spread.ts", import.meta.url),
        "utf8",
      ),
    );
    const output = join(dir, "module.json");
    const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
    expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
    expect(proofs.length).toBeGreaterThan(0);
    expect(proofs.every((p) => p.checkerUnmapped && p.indexed)).toBe(true);
    expect(readFileSync(output, "utf8")).toContain("dyn.copyDataProperties");
  } finally {
    spy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  }
});
