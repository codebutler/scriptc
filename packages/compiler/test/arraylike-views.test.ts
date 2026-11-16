import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile, deserializeModule, validateModule } from "../src/index.js";
import { everyStmtList } from "../src/ir/traverse.js";

async function moduleOf(source: string) {
  const dir = await mkdtemp(join(tmpdir(), "scriptc-arraylike-"));
  try {
    const entry = join(dir, "main.ts");
    const outPath = join(dir, "main.ir.json");
    await writeFile(entry, source);
    const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath });
    if (!result.ok) throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
    const mod = deserializeModule(await readFile(outPath, "utf8"));
    expect(validateModule(mod)).toEqual([]);
    return mod;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("stdlib ArrayLike keeps a live dynamic receiver and keyed read", async () => {
  const mod = await moduleOf(`
function read(values: ArrayLike<number>, index: number): number | undefined { return values[index]; }
console.log(read([3], 0), read(new Uint8Array([4]), 0), read({ 0: 5, length: 1 }, 0));
`);
  const read = mod.functions.find((fn) => fn.name === "read");
  expect(read?.params[0]?.type).toEqual({ kind: "dyn" });
  const keys: string[] = [];
  const visit = (name: string): void => {
    const fn = mod.functions.find((candidate) => candidate.name === name);
    if (fn === undefined) return;
    everyStmtList(fn.body, {
      expr: (e) => {
        keys.push(e.kind === "libCall" ? e.fn : e.kind);
        if (e.kind === "call" && e.callee.startsWith("%dyn.class.computed")) visit(e.callee);
        return true;
      },
      stmt: () => true,
    });
  };
  visit(read!.name);
  expect(keys).toContain("dynKeyGet");
  expect(read?.returnType.kind).toBe("union");
  expect(keys).not.toContain("arrayGet");
});

test("ArrayLike aliases preserve getter-backed inputs", async () => {
  await moduleOf(`
type View<T> = ArrayLike<T>;
function read<T>(values: View<T>, index: number): T | undefined { return values[index]; }
const value = { length: 1, get 0() { return { id: 1 }; } };
console.log(read(value, 0)?.id, read("abc", 1));
`);
});

test("a user interface named ArrayLike keeps its ordinary record representation", async () => {
  const mod = await moduleOf(`
export {};
interface ArrayLike<T> { value: T; }
function read(value: ArrayLike<number>): number { return value.value; }
console.log(read({ value: 7 }));
`);
  expect(mod.functions.find((fn) => fn.name === "read")?.params[0]?.type.kind).toBe("record");
});

// A false type assertion keeps scriptc's checked-boundary policy. Node
// erases it, so this case belongs outside the differential corpus.
test("ArrayLike validates present values while preserving absent indices", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scriptc-arraylike-check-"));
  try {
    const entry = join(dir, "main.ts");
    await writeFile(
      entry,
      `
function read(values: ArrayLike<number>, i: number): number | undefined { return values[i]; }
const wrong: unknown = { 0: "wrong", length: 1 };
try { read(wrong as ArrayLike<number>, 0); }
catch (error) { console.log("checked", error instanceof TypeError); }
console.log("absent", read(wrong as ArrayLike<number>, 4));
console.log("recovery", read([7], 0));
`,
    );
    const built = await compile(entry, {
      outDir: dir,
      outPath: join(dir, "program"),
      sanitize: process.env["SCRIPTC_SAN"] === "1",
    });
    if (!built.ok) throw new Error(built.diagnostics.map((d) => d.message).join("\n"));
    const child = spawnSync(built.binaryPath, [], { encoding: "utf8", timeout: 30_000 });
    expect(child.error).toBeUndefined();
    expect(child.signal).toBeNull();
    expect(child.status).toBe(0);
    expect(child.stderr).toBe("");
    expect(child.stdout).toBe("checked true\nabsent undefined\nrecovery 7\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
