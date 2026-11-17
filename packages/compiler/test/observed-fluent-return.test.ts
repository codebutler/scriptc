import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import type { IrExpr, IrModule } from "../src/ir/ir.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { everyStmtList } from "../src/ir/traverse.js";
import { validateModule } from "../src/ir/validate.js";

async function withModule(source: string, check: (module: IrModule) => void): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-observed-fluent-"));
  try {
    const entry = join(dir, "main.ts");
    const output = join(dir, "main.ir.json");
    writeFileSync(entry, source);
    const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: output });
    expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
    if (!result.ok) return;
    const module = deserializeModule(readFileSync(output, "utf8"));
    expect(validateModule(module)).toEqual([]);
    check(module);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function expressions(module: IrModule): IrExpr[] {
  const result: IrExpr[] = [];
  for (const fn of module.functions) {
    everyStmtList(fn.body, {
      expr(node) {
        result.push(node);
        return true;
      },
      stmt() {
        return true;
      },
    });
  }
  return result;
}

for (const observation of [
  "console.log(typeof Base.prototype.append);",
  "function write<T, K extends keyof T>(target: T, key: K, value: T[K]): void { target[key] = value; } console.log(typeof write);",
]) {
  test(`observed fluent results retain the call-site class: ${observation.slice(0, 24)}`, async () => {
    await withModule(
      `
class Base { append(value: string): this { console.log(value); return this; } }
class Widget extends Base { child(): this { return this.append("ok"); } }
class Deeper extends Widget { extra = 42; }
${observation}
console.log(new Deeper().child().extra);
`,
      (module) => {
        const nodes = expressions(module);
        expect(nodes.some((node) => node.kind === "call" && node.callee === "%Base.append")).toBe(
          true,
        );
        expect(
          nodes.some((node) => node.kind === "instanceOf" && node.className === "Widget"),
        ).toBe(true);
        expect(
          nodes.some((node) => node.kind === "instanceOf" && node.className === "Deeper"),
        ).toBe(true);
        expect(
          nodes.some(
            (node) =>
              node.kind === "call" &&
              node.callee.startsWith("%class.assert") &&
              node.type.kind === "object" &&
              node.type.className === "Deeper",
          ),
        ).toBe(true);
      },
    );
  });
}

test("the adapted own entry checks the inherited caller's descendant result", async () => {
  await withModule(
    `
class Base { child(): unknown { return this; } }
class Widget extends Base { child(): this { return this.hop(); } hop(): this { return this; } }
class Deeper extends Widget { extra = 42; }
console.log(typeof Widget.prototype.hop);
Object.defineProperty(Widget.prototype, "hop", { value: () => new Widget(), configurable: true });
console.log(new Deeper().child().extra);
`,
    (module) => {
      const nodes = expressions(module);
      expect(
        nodes.some(
          (node) =>
            node.kind === "call" &&
            node.callee.startsWith("%class.assert") &&
            node.args.some((arg) => arg.kind === "call" && arg.callee === "%Widget.child$own"),
        ),
      ).toBe(true);
      expect(nodes.some((node) => node.kind === "instanceOf" && node.className === "Deeper")).toBe(
        true,
      );
    },
  );
});

test("nominal base results do not acquire a descendant return claim", async () => {
  await withModule(
    `
class Base { append(): Base { return this; } }
class Widget extends Base { extra = 42; }
console.log(typeof Base.prototype.append, new Widget().append() instanceof Base);
`,
    (module) => {
      expect(
        expressions(module).some(
          (node) => node.kind === "call" && node.callee.startsWith("%class.assert"),
        ),
      ).toBe(false);
    },
  );
});
