import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile, deserializeModule, type ScrDiagnostic } from "../src/index.js";
import type { IrExpr, IrFunction, IrModule } from "../src/ir/ir.js";
import { everyStmtList } from "../src/ir/traverse.js";

interface Lowered {
  diagnostics: ScrDiagnostic[];
  module: IrModule | null;
}

async function lowerSource(source: string): Promise<Lowered> {
  const dir = await mkdtemp(join(tmpdir(), "scriptc-ctor-slot-"));
  try {
    const entry = join(dir, "main.ts");
    await writeFile(entry, source);
    const outPath = join(dir, "main.ir.json");
    const result = await compile(entry, { outPath, outDir: dir, outputKind: "ir" });
    if (!result.ok) return { diagnostics: result.diagnostics, module: null };
    return { diagnostics: [], module: deserializeModule(await readFile(outPath, "utf8")) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function exprsOf(fns: readonly IrFunction[]): IrExpr[] {
  const out: IrExpr[] = [];
  for (const fn of fns) {
    everyStmtList(fn.body, {
      expr: (e) => {
        out.push(e);
        return true;
      },
      stmt: () => true,
    });
  }
  return out;
}

/** The names of the functions the module's closures are made over. */
function closureNames(mod: IrModule): string[] {
  return [
    ...new Set(exprsOf(mod.functions).flatMap((e) => (e.kind === "closure" ? [e.fnName] : []))),
  ].sort();
}

/** The string literals inside the module's function adapters. */
function adapterStrings(mod: IrModule): string[] {
  return exprsOf(mod.functions.filter((fn) => fn.name.startsWith("%fn.adapt."))).flatMap((e) =>
    e.kind === "strLit" ? [e.value] : [],
  );
}

const PRELUDE = `
type Convert = (value: number | bigint) => number | bigint;
const seven: number = Date.now() > 0 ? 7 : 8;
function apply(f: Convert): number | bigint {
  return f(seven);
}
`;

test("a constructor written in a non-string slot takes the any-argument form", async () => {
  const { diagnostics, module } = await lowerSource(`${PRELUDE}
const toWord: Convert = seven > 100 ? BigInt : Number;
console.log(apply(toWord), apply(seven < 100 ? Number : BigInt));
export {};
`);
  expect(diagnostics).toEqual([]);
  expect(closureNames(module!)).toEqual(
    expect.arrayContaining(["%builtin.BigInt", "%builtin.Number.dyn"]),
  );
  expect(closureNames(module!)).not.toContain("%builtin.Number");
  expect(adapterStrings(module!).some((s) => s.includes("not representable"))).toBe(false);
});

test("a string slot keeps the string-input constructor", async () => {
  const { diagnostics, module } = await lowerSource(`
const parse: (text: string) => number = Number;
function run(f: (text: string) => number, text: string): number {
  return f(text);
}
console.log(run(parse, " 5 "), run(Number, "0x10"), parse === Number);
export {};
`);
  expect(diagnostics).toEqual([]);
  expect(closureNames(module!)).toContain("%builtin.Number");
  expect(closureNames(module!)).not.toContain("%builtin.Number.dyn");
});

test("a stored constructor value dispatches to the any-argument form by identity", async () => {
  const { diagnostics, module } = await lowerSource(`${PRELUDE}
let stored = Number;
if (seven > 100) stored = Number;
console.log(apply(stored));
export {};
`);
  expect(diagnostics).toEqual([]);
  const adapters = module!.functions.filter((fn) => fn.name.startsWith("%fn.adapt."));
  const dispatch = adapters
    .flatMap((fn) => fn.body)
    .find(
      (s) =>
        s.kind === "if" &&
        s.cond.kind === "bin" &&
        s.cond.op === "===" &&
        s.cond.right.kind === "closure" &&
        s.cond.right.fnName === "%builtin.Number",
    );
  expect(dispatch).toBeDefined();
  expect(closureNames(module!)).toContain("%builtin.Number.dyn");
});
