import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";

test.each([
  ["typed map", "Map<string, Message>"],
  ["callable", "(() => Message)"],
  ["additional dictionary member", "{ tag: Message; [key: string]: Message }"],
  ["indexed class", "Indexed"],
])("retains the recursive union refusal for a %s arm", async (_name, arm) => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-recursive-buffer-"));
  try {
    const entry = join(dir, "input.ts");
    writeFileSync(
      entry,
      `
      class Indexed { [key: string]: Message }
      type Message = null | ArrayBuffer | readonly Message[] | ${arm};
      class Box<T> {
        constructor(readonly value: T, readonly receive: (v: T, m: Message) => T) {}
        call(m: Message) { return this.receive(this.value, m); }
      }
      console.log(new Box(5, (v: number) => v + 1).call(null));
      export {};
    `,
    );
    const result = await compile(entry, { outputKind: "ir", outDir: dir });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SC2009",
        message: expect.stringContaining("parameter 'm'"),
      }),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
