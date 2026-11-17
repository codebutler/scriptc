import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";

test("optional inherited fluent results reject invalid descendants before tail access", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-optional-fluent-policy-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(
      entry,
      `
class Base { touch(value: number): this { console.log(value); return this; } }
class Item extends Base { extra = 42; }
let reads = 0;
class Deeper extends Item { read(): number { reads++; return this.extra; } }
class Deepest extends Deeper { last = 7; }
class Other { extra = 99; }
let calls = 0, argumentsRun = 0;
function argument(): number { argumentsRun++; return 1; }
function run(value: Deeper | undefined): void { const result = value?.touch(argument()).read(); console.log("result", result); }
function check(returned: unknown): void {
 Object.defineProperty(Base.prototype, "touch", { configurable: true, value: () => { calls++; return returned; } });
 try { run(new Deeper()); } catch(error) { console.log("rejected", error instanceof TypeError); }
}
run(undefined);
check(new Base()); check(new Item()); check(new Other()); check(null); check(undefined);
check(new Deeper()); check(new Deepest());
console.log("counts", calls, argumentsRun, reads);
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
    expect({
      status: run.status,
      signal: run.signal,
      stdout: run.stdout,
      stderr: run.stderr,
    }).toEqual({
      status: 0,
      signal: null,
      stderr: "",
      stdout:
        "result undefined\nrejected true\nrejected true\nrejected true\nrejected true\nrejected true\nresult 42\nresult 42\ncounts 7 7 2\n",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
