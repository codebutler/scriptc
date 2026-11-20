import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";

test("a generic method closure retains the conditional layout of its receiver", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-generic-receiver-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(
      entry,
      `
type Choice<K> = K extends "number" ? number : string;
class Host<K> {
  readonly choice: Choice<K>;
  constructor(choice: Choice<K>) { this.choice = choice; }
  #wrap<A extends unknown[], R>(run: (...args: A) => R): (...args: A) => R {
    return (...args) => {
      console.log(this.choice);
      return run(...args);
    };
  }
  add() { return this.#wrap((value: number) => value + 1); }
  label() { return this.#wrap((value: string) => value + "!"); }
}
const first = new Host<"number">(42);
const second = new Host<"text">("second");
const a = first.add();
const b = second.label();
console.log(b("ok"), a(8), second.add()(0), first.label()("end"));
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
    expect([run.status, run.signal, run.stdout, run.stderr]).toEqual([
      0,
      null,
      "second\n42\nsecond\n42\nok! 9 1 end!\n",
      "",
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
