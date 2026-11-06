import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";

test("boxing keeps the refusal for factory accessor receivers", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scriptc-accessor-receiver-refusal-"));
  try {
    const entry = join(dir, "main.ts");
    await writeFile(
      entry,
      `function make(value: number) {
  const literal = { state: { value }, get current() { return this.state.value; } };
  const boxed: object = literal;
  return { literal, boxed };
}
const first = make(1), second = make(2);
const descriptor = Object.getOwnPropertyDescriptor(first.boxed, "current");
console.log(descriptor?.get?.call(second.literal));
`,
    );
    const result = await compile(entry, { outputKind: "ir", outDir: dir });
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "SC1090" &&
          diagnostic.message.includes("references to 'this' in object literal get/set accessors"),
      ),
    ).toBe(true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
