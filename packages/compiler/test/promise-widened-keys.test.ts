import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { analyze } from "../src/index.js";

function diagnostics(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-promise-widened-key-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(entry, source);
    return analyze(entry, {}).coverage.diagnostics;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("typed promises enter unknown-payload Set and Map keys", () => {
  expect(
    diagnostics(`interface Layout {width:number;dispose():void}
const item:Layout={width:3,dispose(){}};const promise=Promise.resolve(item);
const set=new Set<Promise<unknown>>();set.add(promise);set.has(promise);set.delete(promise);
const map=new Map<Promise<unknown>,number>();map.set(promise,1);map.get(promise);map.has(promise);map.delete(promise);`),
  ).toEqual([]);
});

test("unknown promise keys do not admit arbitrary typed payload narrowing", () => {
  const failures = diagnostics(`const promise:Promise<any>=Promise.resolve("wrong");
const set=new Set<Promise<number>>();set.add(promise);`);
  expect(failures.some((d) => d.message.includes("collection key conversion"))).toBe(true);
});

test("promise widening does not admit structural record key copies", () => {
  const failures = diagnostics(
    `const key={id:1,extra:2};const set=new Set<{id:number}>();set.add(key);`,
  );
  expect(failures.some((d) => d.message.includes("collection key conversion"))).toBe(true);
});

test("a dynamic assertion still cannot bypass collection key checks", () => {
  const failures = diagnostics(
    `const source:unknown=Promise.resolve(3);const set=new Set<Promise<unknown>>();set.add(source as Promise<number>);`,
  );
  expect(failures.some((d) => d.message.includes("collection key assertion"))).toBe(true);
});
