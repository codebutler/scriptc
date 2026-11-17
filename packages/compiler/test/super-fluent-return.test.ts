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
  const dir = mkdtempSync(join(tmpdir(), "scriptc-super-fluent-"));
  try {
    const entry = join(dir, "main.ts"),
      output = join(dir, "main.ir.json");
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
  return nodes;
}
for (const mode of ["native", "observed", "census", "literal"] as const) {
  test(`super fluent result uses checked descendant projection: ${mode}`, async () => {
    const call = mode === "literal" ? 'super["append"]("value")' : 'super.append("value")';
    const observation =
      mode === "observed"
        ? "console.log(typeof Base.prototype.append);"
        : mode === "census"
          ? "function write<T, K extends keyof T>(target: T, key: K, value: T[K]): void { target[key] = value; } console.log(typeof write);"
          : "";
    await withModule(
      `
class Base { append(value: string): this { console.log("base", value); return this; } }
class Widget extends Base {
 append(value: string): this { console.log("own", value); return this; }
 child(): this { return ${call}; }
}
class Deeper extends Widget { extra = 42; }
${observation}
console.log(new Deeper().child().extra);
`,
      (module) => {
        const nodes = expressions(module);
        expect(
          nodes.some((node) => node.kind === "instanceOf" && node.className === "Widget"),
        ).toBe(true);
        expect(
          nodes.some((node) => node.kind === "instanceOf" && node.className === "Deeper"),
        ).toBe(true);
        const child = module.functions.find((fn) => fn.name === "%Widget.child");
        expect(child).toBeDefined();
        if (!child) return;
        const body = JSON.stringify(child.body);
        if (mode === "native" || mode === "literal") {
          expect(body).toContain('"callee":"%Base.append"');
          expect(body).not.toContain('"callee":"%Widget.append"');
          expect(body).not.toContain('"kind":"virtualCall"');
        } else {
          expect(body).toContain('"kind":"dynCall"');
          expect(child.locals.some((local) => local.name === "%superCallee")).toBe(true);
          expect(child.locals.some((local) => local.name === "%superReceiver")).toBe(true);
        }
      },
    );
  });
}
test("super calls the base override's own parameter ABI before checking its result", async () => {
  await withModule(
    `
class Root { append(): unknown { return this; } }
class Base extends Root { append(value = 1): this { console.log(value); return this; } }
class Widget extends Base { child(): this { return super.append(7); } }
console.log(new Widget().child() instanceof Widget);
`,
    (module) => {
      const nodes = expressions(module);
      expect(
        nodes.some(
          (node) =>
            node.kind === "call" && node.callee === "%Base.append$own" && node.args.length === 2,
        ),
      ).toBe(true);
      expect(nodes.some((node) => node.kind === "instanceOf" && node.className === "Widget")).toBe(
        true,
      );
    },
  );
});
test("nominal base result retains its declared class", async () => {
  await withModule(
    `
class Base { append(): Base { return this; } }
class Widget extends Base { child(): Base { return super.append(); } }
console.log(new Widget().child() instanceof Base);
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
