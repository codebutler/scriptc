import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";

const boundaries = [
  {
    name: "outer class-name assignment",
    source: "function make() { class C {} C = class Other {}; return C; } console.log(make());",
    code: "SC1090",
    message: "assigning to a class name binding",
  },
  {
    name: "inner class-name assignment",
    source:
      "function make() { class C { static { C = class Other {}; } } return C; } console.log(make());",
    code: "SC1090",
    message: "assigning to a class name binding",
  },
  {
    name: "direct computed class-name read",
    source:
      "function make() { class C { [C.name]() { return 1; } } return C; } console.log(make());",
    code: "SC0001",
    message: "used before its declaration",
  },
];

test.each(boundaries)("preserves the existing $name refusal", async ({ source, code, message }) => {
  const directory = mkdtempSync(join(tmpdir(), "scriptc-class-initialization-boundary-"));
  try {
    const entry = join(directory, "main.mjs");
    writeFileSync(entry, source);
    const result = await compile(entry, {
      outDir: directory,
      outPath: join(directory, "program.ir"),
      outputKind: "ir",
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code, message: expect.stringContaining(message) }),
      ]),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
