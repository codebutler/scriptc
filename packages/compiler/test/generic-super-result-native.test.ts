import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";

test("generic super checks reject incompatible specialized results", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-generic-super-policy-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(
      entry,
      `
class Base { append(): this { return this; } }
class Child<T> extends Base {
 readonly item:T;
 constructor(item:T){super();this.item=item;}
 child():this{return super.append();}
}
class Deeper extends Child<string> { extra=42;constructor(){super("deep");} }
let calls = 0;
function check(value: unknown): void {
 Object.defineProperty(Base.prototype, "append", { configurable: true, value: () => { calls++; return value; } });
 try { console.log("read", new Child("unused").child().item.toUpperCase()); }
 catch(error) { console.log("rejected", error instanceof TypeError); }
}
check(new Base()); check(null); check(new Child(7));
check(new Child("good")); check(new Deeper());
console.log("calls", calls);
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
      stdout: "rejected true\nrejected true\nrejected true\nread GOOD\nread DEEP\ncalls 5\n",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
