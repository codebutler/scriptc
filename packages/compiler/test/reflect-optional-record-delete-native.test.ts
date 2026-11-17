import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";

test("native record Reflect deletion fences unproved storage and object keys before mutation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-reflect-record-policy-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(
      entry,
      `
type State = { a?: number };
function remove(value: State, key: any): boolean { return Reflect.deleteProperty(value, key); }
let conversions = 0;
function attempt(value: State, key: any): void {
 try { console.log("unexpected", remove(value, key)); }
 catch (error) { console.log("refused", error instanceof Error && "code" in error && error.code === "SC1090", value.a); }
}
const plain: State = { a: 1 };
attempt(plain, { toString() { conversions++; return "a"; } });
attempt(plain, { [Symbol.toPrimitive]() { conversions++; return "a"; } });
attempt(plain, () => "a");
console.log("hooks", conversions, "a" in plain);
type CheckedState = { a?: number | string };
function checkedRemove(value: CheckedState): void {
 try { console.log("unexpected checked", Reflect.deleteProperty(value, "a")); }
 catch (error) { console.log("checked refused", error instanceof Error && "code" in error && error.code === "SC1090", value.a); }
}
const original: { a?: number; b?: number } = { a: 2, b: 3 };
const raw: unknown = original;
const checked = raw as CheckedState;
checkedRemove(checked);
console.log("source", JSON.stringify(raw), original.a, checked.a);
const parsed: unknown = JSON.parse('{"a":4}');
checkedRemove(parsed as CheckedState);
console.log("parsed", JSON.stringify(parsed));
const copiedSource: { a?: number; b?: number } = { a: 6, b: 7 };
const copied: { a?: number | boolean } = copiedSource;
try { console.log("unexpected copied", Reflect.deleteProperty(copied, "a")); }
catch (error) { console.log("copy refused", error instanceof Error && "code" in error && error.code === "SC1090", copiedSource.a, copied.a); }
const wider: { a?: number; b?: number } = { a: 3, b: 4 };
console.log("alias", remove(wider, "a"), "a" in wider, wider.b);
const frozen: State = { a: 5 }; Object.freeze(frozen);
console.log("frozen", remove(frozen, "a"), frozen.a, remove(frozen, "absent"));
export {};
`,
    );
    const result = await compile(entry, {
      outDir: dir,
      outPath: join(dir, "program"),
      sanitize: process.env["SCRIPTC_SAN"] === "1",
    });
    expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
    if (!result.ok) return;
    const run = spawnSync(result.binaryPath, [], { encoding: "utf8", timeout: 30_000 });
    expect(run.error).toBeUndefined();
    expect(
      { status: run.status, signal: run.signal, stdout: run.stdout, stderr: run.stderr },
      JSON.stringify({ stdout: run.stdout, stderr: run.stderr }),
    ).toEqual({
      status: 0,
      signal: null,
      stderr: "",
      stdout:
        'refused true 1\nrefused true 1\nrefused true 1\nhooks 0 true\nchecked refused true 2\nsource {"a":2,"b":3} 2 2\nchecked refused true 4\nparsed {"a":4}\ncopy refused true 6 6\nalias true false 4\nfrozen false 5 true\n',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
