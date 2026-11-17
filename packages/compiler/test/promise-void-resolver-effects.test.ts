import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { analyze, compile } from "../src/index.js";

function diagnostics(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-void-resolver-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(entry, source);
    return analyze(entry, {}).coverage.diagnostics;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const effect = `function effect():void { console.log("effect"); }`;

test("void promise resolution evaluates a void operand", () => {
  expect(diagnostics(`${effect} void new Promise<void>(resolve => resolve(effect()));`)).toEqual(
    [],
  );
});

test("captured generic void resolvers retain the checked operand", () => {
  expect(
    diagnostics(`function enqueue<T>(value:T):Promise<T> {
return new Promise<T>(resolve => { const callback=(input:unknown)=>{resolve(input as T);};callback(value); });
} void enqueue<void>(undefined);`),
  ).toEqual([]);
});

test("function expression executors retain void operand effects", () => {
  expect(
    diagnostics(`${effect} void new Promise<void>((function(resolve) { resolve(effect()); }));`),
  ).toEqual([]);
});

for (const [name, source] of [
  [
    "arguments-aliasing executor",
    `void new Promise<void>(function(resolve) { arguments[0]=()=>{};resolve(effect()); });`,
  ],
  [
    "ordinary callback",
    `function invoke(resolve:(value:void)=>void) { resolve(effect()); } invoke(()=>{});`,
  ],
  [
    "reassigned resolver",
    `void new Promise<void>(resolve => { resolve=()=>{};resolve(effect()); });`,
  ],
  [
    "resolver alias",
    `void new Promise<void>(resolve => { const alias=resolve;alias(effect()); });`,
  ],
]) {
  test(`does not erase arguments for an unproved ${name}`, () => {
    expect(diagnostics(effect + source).some((d) => d.code === "SC1090")).toBe(true);
  });
}

test("void resolver operands retain checked-undefined assertions", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-void-resolver-policy-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(
      entry,
      `
function enqueue<T>(input:unknown):Promise<T> {
  return new Promise<T>(resolve=>{resolve(input as T);});
}
async function main() {
  for (const input of [3,null]) {
    try { await enqueue<void>(input);console.log("invalid fulfilled"); }
    catch(error) { console.log("rejected",error instanceof TypeError); }
  }
  await enqueue<void>(undefined);console.log("recovered");
}
void main();`,
    );
    const result = await compile(entry, {
      outDir: dir,
      outPath: join(dir, "program"),
      sanitize: process.env["SCRIPTC_SAN"] === "1",
    });
    expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
    if (!result.ok) return;
    const child = spawnSync(result.binaryPath, [], { encoding: "utf8", timeout: 10000 });
    expect(child.status, child.stderr).toBe(0);
    expect(child.stdout).toBe("rejected true\nrejected true\nrecovered\n");
    expect(
      child.stderr.replace(
        /^==\d+==WARNING: ASan doesn't fully support makecontext\/swapcontext functions and may produce false positives in some cases!\n/gm,
        "",
      ),
    ).toBe("");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 60000);
