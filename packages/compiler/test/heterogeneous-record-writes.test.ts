import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile, deserializeModule, validateModule } from "../src/index.js";
import { everyStmtList } from "../src/ir/traverse.js";

async function moduleOf(source: string) {
  const dir = await mkdtemp(join(tmpdir(), "scriptc-keyed-record-"));
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

test("generic indexed access joins nested field representations", async () => {
  const mod = await moduleOf(`
function read<T extends object>(value: T, key: keyof T): T[keyof T] { return value[key]; }
type Edge = number | { unit: string; value: number };
interface Row { width?: Edge; padding?: Edge | { left?: Edge }; label?: string; }
const value: Row = { width: 7, padding: { left: 8 }, label: "a" };
console.log(read(value, "width"), read(value, "label"));
`);
  const read = mod.functions.find((fn) => fn.sourceName === "read");
  expect(read?.returnType.kind).toBe("union");
  const kinds: string[] = [];
  everyStmtList(read!.body, {
    expr: (e) => {
      kinds.push(e.kind);
      return true;
    },
    stmt: () => true,
  });
  expect(kinds).toContain("recordKeyGet");
});

test("heterogeneous writes check the selected field before storing", async () => {
  const mod = await moduleOf(`
function write<T extends object>(value: T, key: keyof T, field: T[keyof T]): void { value[key] = field; }
const value: { n?: number; text?: string } = { n: 1, text: "a" };
write(value, "n", 7);
`);
  const write = mod.functions.find((fn) => fn.sourceName === "write");
  const stores: string[] = [];
  const checks: string[] = [];
  everyStmtList(write!.body, {
    expr: (e) => {
      if (e.kind === "dynCheck") checks.push(e.type.kind);
      return true;
    },
    stmt: (s) => {
      if (s.kind === "recordSet") stores.push(s.field);
      return true;
    },
  });
  expect([...new Set(stores)].sort()).toEqual(["n", "text"]);
  expect(checks).toHaveLength(2);
});

test("a mismatched value or unknown key throws without changing the record", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scriptc-keyed-record-policy-"));
  try {
    const entry = join(dir, "main.ts");
    await writeFile(
      entry,
      `
interface Row { n?: number; text?: string; }
function write<T extends object>(value: T, key: keyof T, field: T[keyof T]): void { value[key] = field; }
const row: Row = { n: 1, text: "a" };
try { write(row, "n", "wrong"); } catch (error) { console.log("value", error instanceof TypeError); }
try { write(row, "extra" as keyof Row, 7); } catch (error) { console.log("key", error instanceof TypeError); }
console.log("unchanged", row.n, row.text);
write(row, "text", "ok"); write(row, "n", undefined);
console.log("recovered", row.n, row.text);
const empty: Row = {};
try { write(empty, "text", 1); } catch (error) { console.log("absent", error instanceof TypeError, Object.keys(empty).length); }
write(empty, "n", 2); write(empty, "text", "new");
console.log("keys", Object.keys(empty).join(","));
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
    expect(child.stdout).toBe(
      "value true\nkey true\nunchanged 1 a\nrecovered undefined ok\nabsent true 0\nkeys n,text\n",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("required heterogeneous fields need no insertion-order storage", async () => {
  const mod = await moduleOf(`
function write<T extends object>(value: T, key: keyof T, field: T[keyof T]): void { value[key] = field; }
const value = { n: 1, text: "a" };
write(value, "n", 7); console.log(Object.keys(value));
`);
  expect(JSON.stringify(mod)).not.toContain("record.sourceAppend");
});

test("heterogeneous writes retain the prototype-key refusal", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scriptc-keyed-record-proto-"));
  try {
    const entry = join(dir, "main.ts");
    await writeFile(
      entry,
      `
function write<T extends object>(value: T, key: keyof T, field: T[keyof T]): void { value[key] = field; }
const value = JSON.parse('{"__proto__":1,"text":"a"}') as { __proto__: number; text: string };
write(value, "__proto__", 2);
`,
    );
    const result = await compile(entry, {
      outputKind: "ir",
      outDir: dir,
      outPath: join(dir, "module.json"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("prototype-key write unexpectedly compiled");
    expect(result.diagnostics.some((d) => d.code === "SC1090")).toBe(true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test.each(["receiver", "key"] as const)(
  "record insertion metadata rejects an invalid %s",
  async (part) => {
    const mod = await moduleOf(`
function write<T extends object>(value: T, key: keyof T, field: T[keyof T]): void { value[key] = field; }
const value: { n?: number; text?: string } = {};
write(value, "n", 7); console.log(Object.keys(value));
`);
    let changed = 0;
    for (const fn of mod.functions)
      everyStmtList(fn.body, {
        expr: (e) => {
          if (e.kind === "libCall" && e.fn === "record.sourceAppend") {
            if (part === "receiver")
              e.args[0] = { kind: "numLit", value: 1, type: { kind: "f64" }, loc: e.loc };
            else
              e.args[2] = {
                kind: "strLit",
                value: "missing",
                type: { kind: "string" },
                loc: e.loc,
              };
            changed++;
          }
          return true;
        },
        stmt: () => true,
      });
    expect(changed).toBeGreaterThan(0);
    expect(validateModule(mod).some((d) => d.message.includes(`sourceAppend ${part}`))).toBe(true);
  },
);
