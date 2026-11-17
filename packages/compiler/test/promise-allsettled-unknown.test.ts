import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

for (const declaration of ["unknown[]", "readonly unknown[]", "any[]"] as const) {
  test(
    declaration === "any[]"
      ? "Promise.allSettled retains the unmapped any-array boundary"
      : `Promise.allSettled consumes ${declaration} through checked values`,
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "scriptc-allsettled-unknown-"));
      try {
        const entry = join(dir, "main.ts"),
          output = join(dir, "main.ir.json");
        writeFileSync(
          entry,
          `async function main(): Promise<void> {
 const pending: ${declaration} = [Promise.resolve(1), undefined, Promise.reject("reason")];
 const results = await Promise.allSettled(pending);
 for (const result of results) { if (result.status === "fulfilled") console.log("value", result.value); else console.log("error", result.reason); }
 } void main(); export {};`,
        );
        const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
        expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(
          declaration !== "any[]",
        );
        if (!result.ok) return;
        const module = deserializeModule(readFileSync(output, "utf8"));
        expect(validateModule(module)).toEqual([]);
        const functions = JSON.stringify(module.functions);
        expect(functions).toContain("promise.allSettledChecked");
        expect(functions).toContain("%promise.thenOf");
        expect(functions).not.toContain("dyn.promiseAllSettled");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
}

for (const mutation of [
  `Object.defineProperty(Promise.prototype, "constructor", { get(): never { throw new Error("constructor"); } });`,
  `Promise.prototype.constructor = function Foreign(): void {};`,
]) {
  test(`checked allSettled retains the built-in constructor mutation fence: ${mutation}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-allsettled-constructor-"));
    try {
      const entry = join(dir, "main.ts");
      writeFileSync(
        entry,
        `const value = Promise.resolve(1);
${mutation}
const input: unknown[] = [value];
Promise.allSettled(input);
export {};`,
      );
      const result = await compile(entry, {
        outputKind: "ir",
        outDir: dir,
        outPath: join(dir, "main.ir.json"),
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("constructor mutation unexpectedly compiled");
      expect(
        result.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "SC1092" &&
            diagnostic.reason === "builtin-write" &&
            diagnostic.message.includes("Promise.prototype.constructor") &&
            diagnostic.message.includes("Promise.allSettled"),
        ),
        JSON.stringify(result.diagnostics),
      ).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
