import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";

test("method result checks reject a wrong descendant before reading its fields", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-fluent-policy-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(
      entry,
      `
class Base { append(): this { return this; } }
class Widget extends Base { child(): this { return this.append(); } }
class Deeper extends Widget { extra = 42; }
class Deepest extends Deeper { last = 7; }
class Other { extra = 99; }
let calls = 0;
function check(value: unknown): void {
 Object.defineProperty(Base.prototype, "append", { configurable: true, value: () => { calls++; return value; } });
 try { console.log("read", new Deeper().child().extra); }
 catch(error) { console.log("rejected", error instanceof TypeError); }
}
check(new Base()); check(new Widget()); check(new Other()); check(null);
check(new Deeper()); check(new Deepest());
console.log("calls", calls);
class OwnBase { child(): unknown { return this; } }
class Own extends OwnBase { child(): this { return this.hop(); } hop(): this { return this; } }
class OwnDeeper extends Own { extra = 8; }
Object.defineProperty(Own.prototype, "hop", { configurable: true, value: () => new Own() });
try { console.log("own read", new OwnDeeper().child().extra); }
catch(error) { console.log("own rejected", error instanceof TypeError); }
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
        "rejected true\nrejected true\nrejected true\nrejected true\nread 42\nread 42\ncalls 6\nown rejected true\n",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
