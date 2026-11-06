import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";

test("explicit JSDoc result contracts remain checked on open-member returns", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-open-member-contracts-"));
  try {
    const entry = join(dir, "main.mjs");
    writeFileSync(
      entry,
      `
/** @returns {string} */
function generate(decorator) {
  let handlers = { result() { return "text"; } };
  if (decorator) handlers = decorator(handlers);
  return handlers.result();
}
console.log(generate(null));
try { console.log(generate(() => ({ result() { return [7]; } }))); }
catch (error) { console.log(error instanceof TypeError); }
function declaredArrow(decorator) {
  let handlers = { result() { return "arrow"; } };
  if (decorator) handlers = decorator(handlers);
  /** @type {() => string} */
  const run = () => handlers.result();
  return run;
}
try { console.log(declaredArrow(() => ({ result() { return [11]; } }))()); }
catch (error) { console.log(error instanceof TypeError); }
function declaredMethod(decorator) {
  let handlers = { result() { return "method"; } };
  if (decorator) handlers = decorator(handlers);
  /** @type {{ run(): string }} */
  const api = { run() { return handlers.result(); } };
  return api;
}
try { console.log(declaredMethod(() => ({ result() { return [13]; } })).run()); }
catch (error) { console.log(error instanceof TypeError); }
`,
    );
    const result = await compile(entry, {
      backend: "llvm",
      sanitize: process.env["SCRIPTC_SAN"] === "1",
      outDir: dir,
      outPath: join(dir, "program"),
    });
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    if (!result.ok) return;
    const child = spawnSync(result.binaryPath, [], { encoding: "utf8" });
    expect(child.status).toBe(0);
    expect(child.stderr).toBe("");
    expect(child.stdout).toBe("text\ntrue\ntrue\ntrue\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
