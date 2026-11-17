import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

async function check(
  source: string,
  accepted: boolean,
  checkedOrigin = false,
  linkedOrigin = false,
): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-reflect-record-delete-"));
  try {
    const entry = join(dir, "main.ts"),
      output = join(dir, "main.ir.json");
    writeFileSync(entry, `${source}\nexport {};`);
    const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
    expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(accepted);
    if (result.ok) {
      const module = deserializeModule(readFileSync(output, "utf8"));
      expect(validateModule(module)).toEqual([]);
      if (linkedOrigin) {
        expect(module.recordLinks?.length).toBeGreaterThan(0);
        expect(
          JSON.stringify(module.functions.filter((fn) => fn.name.startsWith("%obj.reflectDelete"))),
        ).toContain("record.linkIs");
      }
      if (checkedOrigin) {
        const helpers = module.functions.filter((fn) => fn.name.startsWith("%obj.reflectDelete"));
        expect(helpers.length).toBeGreaterThan(0);
        for (const helper of helpers) {
          expect(helper.body).toHaveLength(1);
          expect(JSON.stringify(helper.body)).toContain(
            "record type reachable through a checked conversion",
          );
        }
      }
    } else
      expect(result.diagnostics.some((d) => d.code === "SC2020" || d.code === "SC1090")).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("Reflect deletes a literal-union key from optional record storage", async () => {
  await check(
    `function remove(value: { a?: number; b?: string }, key: "a" | "b"): boolean { return Reflect.deleteProperty(value, key); }
const value = { a: 1, b: "two" }; console.log(remove(value, "a"));`,
    true,
  );
});
test("Reflect deletion in generic state merge uses each specialized optional slot", async () => {
  await check(
    `function merge<T extends object>(target: T, changes: Partial<T>): void {
 for (const [key, value] of Object.entries(changes) as Array<[keyof T, T[keyof T] | undefined]>) {
  if (value === undefined) { if (!Reflect.deleteProperty(target, key)) throw new TypeError("cannot remove"); }
  else target[key] = value;
 }
}
const value: { a?: number; b?: string } = { a: 1, b: "two" }; merge(value, { a: undefined }); console.log(value.b);`,
    true,
  );
});
test("Reflect deletion remains nonthrowing for a frozen optional field", async () => {
  await check(
    `const value: { a?: number } = { a: 1 }; Object.freeze(value); console.log(Reflect.deleteProperty(value, "a"));`,
    true,
  );
});
test("Reflect deletes runtime string keys from a plain optional record", async () => {
  await check(
    `function remove(value: { a?: number }, key: string): boolean { return Reflect.deleteProperty(value, key); } console.log(remove({a:1}, "a"));`,
    true,
  );
});
test("Reflect accepts an absent string key on plain optional storage", async () => {
  await check(
    `const value: { a?: number } = { a: 1 }; console.log(Reflect.deleteProperty(value, "other"));`,
    true,
  );
});
for (const [name, source] of [
  ["required field", `const value = { a: 1 }; console.log(Reflect.deleteProperty(value, "a"));`],
  [
    "asserted record view",
    `const value: { a?: number; b?: number } = { a: 1 }; console.log(Reflect.deleteProperty(value as { a?: number }, "a"));`,
  ],
  [
    "accessor",
    `const value = { get a() { return 1; } }; console.log(Reflect.deleteProperty(value, "a"));`,
  ],
] as const)
  test(`Reflect retains the ${name} representation fence`, () => check(source, false));

for (const operation of ["seal", "preventExtensions"] as const)
  test(`typed record Object.${operation} keeps its existing fence`, () =>
    check(
      `const value: { a?: number } = { a: 1 }; Object.${operation}(value); console.log(value.a);`,
      false,
    ));

for (const [name, source] of [
  [
    "record",
    `const raw: unknown = { a: 1 }; const checked = raw as { a?: number }; remove(checked);`,
  ],
  [
    "array",
    `const raw: unknown = [{ a: 1 }]; const checked = raw as Array<{ a?: number }>; for (const value of checked) remove(value);`,
  ],
  [
    "callable result",
    `const raw: unknown = () => ({ a: 1 }); const checked = raw as () => { a?: number }; remove(checked());`,
  ],
] as const)
  test(`Reflect fences ${name} checked origins`, () =>
    check(
      `function remove(value: { a?: number }): boolean { return Reflect.deleteProperty(value, "a"); } ${source}`,
      true,
      true,
    ));

test("Reflect observes late width-copy links before deleting", () =>
  check(
    `const wide: { a?: number; b?: number } = { a: 1, b: 2 }; const copy: { a?: number | boolean } = wide; console.log(Reflect.deleteProperty(copy, "a"), wide.a);`,
    true,
    false,
    true,
  ));
