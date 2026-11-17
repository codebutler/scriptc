import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import type { IrExpr } from "../src/ir/ir.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { everyStmtList } from "../src/ir/traverse.js";
import { validateModule } from "../src/ir/validate.js";

const prelude = `class Base { touch(): this { return this; } }
class Item extends Base { extra = 42; }
class Deeper extends Item { last = 7; }`;
for (const [name, source, target] of [
  [
    "local",
    `function run(value: Item | undefined): void { value?.touch().touch(); } run(new Item()); run(undefined);`,
    "Item",
  ],
  [
    "private",
    `class Holder { #value?: Item; set(value: Item): void { this.#value = value; } run(): void { this.#value?.touch().touch(); } } const h = new Holder(); h.run(); h.set(new Item()); h.run();`,
    "Item",
  ],
  [
    "unchecked index",
    `function run(items: { row: Item }[], index: number): void { items[index]?.row.touch(); } run([{ row: new Item() }], 0); run([], 0);`,
    "Item",
  ],
  [
    "observed descendant",
    `console.log(typeof Base.prototype.touch); function run(value: Deeper | undefined): void { value?.touch().touch(); } run(new Deeper()); run(undefined);`,
    "Deeper",
  ],
] as const) {
  test(`optional inherited fluent ${name} checks the descendant result`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-optional-fluent-"));
    try {
      const entry = join(dir, "main.ts"),
        output = join(dir, "main.ir.json");
      writeFileSync(
        join(dir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noUncheckedIndexedAccess: true,
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
          },
          files: ["main.ts"],
        }),
      );
      writeFileSync(entry, `${prelude}\n${source}\nexport {};`);
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
      expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
      if (!result.ok) return;
      const module = deserializeModule(readFileSync(output, "utf8"));
      expect(validateModule(module)).toEqual([]);
      const nodes: IrExpr[] = [];
      for (const fn of module.functions)
        everyStmtList(fn.body, {
          expr(node) {
            nodes.push(node);
            return true;
          },
          stmt() {
            return true;
          },
        });
      expect(nodes.some((node) => node.kind === "instanceOf" && node.className === target)).toBe(
        true,
      );
      expect(
        nodes.some(
          (node) =>
            node.kind === "call" &&
            node.callee.startsWith("%class.assert") &&
            node.type.kind === "union",
        ),
      ).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
