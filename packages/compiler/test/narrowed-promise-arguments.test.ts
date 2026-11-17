import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

const prelude = `function observe(p: Promise<unknown>): void { void p.then(value => console.log("settled", value)); }
type Response = Promise<void> | { type: string } | void;`;
for (const [name, source] of [
  [
    "free argument",
    `${prelude}
function invoke(handler: () => Response): void { const value = handler(); if (value instanceof Promise) observe(value); }
invoke(async () => { console.log("run"); });`,
  ],
  [
    "method argument",
    `${prelude}
class Observer { accept(p: Promise<unknown>): void { observe(p); } }
function invoke(handler: () => Response, owner: Observer): void { const value = handler(); if (value instanceof Promise) owner.accept(value); }
invoke(async () => {}, new Observer());`,
  ],
  [
    "returned promise",
    `${prelude}
function select(handler: () => Response): Promise<unknown> { const value = handler(); if (value instanceof Promise) return value; return Promise.resolve(42); }
observe(select(async () => {}));`,
  ],
] as const) {
  test(`narrowed promise widens its payload at a ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-promise-argument-"));
    try {
      const entry = join(dir, "main.ts"),
        output = join(dir, "main.ir.json");
      writeFileSync(entry, source);
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      const module = deserializeModule(readFileSync(output, "utf8"));
      expect(validateModule(module)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
test("an unguarded response union does not become a promise", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-promise-argument-negative-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(
      entry,
      `${prelude}
function invoke(handler: () => Response): void { const value = handler();
// @ts-expect-error Exercise the lowering boundary without a Promise guard.
observe(value); }
invoke(() => ({ type: "sync" }));`,
    );
    const result = await compile(entry, {
      outputKind: "ir",
      outDir: dir,
      outPath: join(dir, "main.ir.json"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.some((d) => d.code === "SC2003")).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
