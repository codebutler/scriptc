import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { compile, deserializeModule, validateModule } from "../src/index.js";

async function fixture(files: Record<string, string>, entry = "main.ts") {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "scriptc-relative-js-")));
  try {
    const inputs = {
      "package.json": '{"type":"module"}',
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          verbatimModuleSyntax: true,
          strict: true,
          allowJs: true,
          skipLibCheck: true,
        },
        files: [entry],
      }),
      ...files,
    };
    for (const [file, text] of Object.entries(inputs)) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), text);
    }
    const output = join(dir, "out.ir.json");
    const result = await compile(join(dir, entry), {
      outputKind: "ir",
      outDir: dir,
      outPath: output,
    });
    if (!result.ok) return { result, module: null };
    const module = deserializeModule(readFileSync(output, "utf8"));
    expect(validateModule(module)).toEqual([]);
    return { result, module };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const nested of [false, true]) {
  test(`relative ESM keeps declaration-only data types and runtime bodies (nested=${nested})`, async () => {
    const { result, module } = await fixture({
      ...(nested ? { "vendor/package.json": '{"type":"module","name":"private-vendor"}' } : {}),
      "vendor/lib.d.mts":
        "export interface Item { value: number }; export declare function make(): Item;",
      "vendor/lib.mjs": "export function make(){return {value:3};}",
      "main.ts":
        'import {make,type Item} from "./vendor/lib.mjs"; const item:Item=make(); console.log(item.value);',
    });
    expect(result.ok, JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(true);
    expect(module?.functions.some((f) => f.sourceName === "make")).toBe(true);
  });
}

test("relative JS declaration contracts reject invalid authored arguments", async () => {
  const { result } = await fixture({
    "vendor/package.json": '{"type":"module"}',
    "vendor/lib.d.mts": "export declare function make(value: number): number;",
    "vendor/lib.mjs": "export function make(value){return 3;}",
    "main.ts": 'import {make} from "./vendor/lib.mjs"; console.log(make("bad"));',
  });
  expect(result.ok).toBe(false);
  expect(
    (result.ok ? [] : result.diagnostics)?.some(
      (d) =>
        d.code === "SC0001" && d.message.includes("not assignable to parameter of type 'number'"),
    ),
  ).toBe(true);
});

test("relative JS follows value re-exports and copied declaration dependencies", async () => {
  const { result } = await fixture({
    "vendor/package.json": '{"type":"module"}',
    "vendor/entry.d.mts": 'export {make} from "./impl.mjs"; export type {Item} from "./types.mjs";',
    "vendor/entry.mjs": 'export {make} from "./impl.mjs";',
    "vendor/impl.d.mts":
      'import type {Item} from "./types.mjs"; export declare function make():Item;',
    "vendor/impl.mjs": "export function make(){return {value:5};}",
    "vendor/types.d.mts": "export interface Item { value: number }",
    "main.ts":
      'import {make,type Item} from "./vendor/entry.mjs"; const item:Item=make(); console.log(item.value);',
  });
  expect(result.ok, JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(true);
});

test("type-only nested imports do not admit or evaluate their runtime sibling", async () => {
  const { result, module } = await fixture({
    "vendor/package.json": '{"type":"module"}',
    "vendor/lib.d.mts": "export interface Contract { read(): number }",
    "vendor/lib.mjs": 'throw new Error("must not load"); export const unrelated=0;',
    "main.ts":
      'import type {Contract} from "./vendor/lib.mjs"; const value:Contract={read(){return 7;}};console.log(value.read());',
  });
  expect(result.ok, JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(true);
  expect(JSON.stringify(module)).not.toContain("must not load");
});

test("relative .js pairs retain data types", async () => {
  const { result } = await fixture({
    "vendor/package.json": '{"type":"module"}',
    "vendor/lib.d.ts":
      "export interface Item { value:number }; export declare function make():Item;",
    "vendor/lib.js": "export function make(){return {value:3};}",
    "main.ts":
      'import {make,type Item} from "./vendor/lib.js";const item:Item=make();console.log(item.value);',
  });
  expect(result.ok, JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(true);
});

test("relative CommonJS pairs retain data types", async () => {
  const { result } = await fixture({
    "vendor/package.json": '{"type":"commonjs"}',
    "vendor/lib.d.cts":
      "export interface Item { value:number }; export declare function make():Item;",
    "vendor/lib.cjs": "exports.make=function make(){return {value:3};};",
    "main.ts":
      'import {make,type Item} from "./vendor/lib.cjs";const item:Item=make();console.log(item.value);',
  });
  expect(result.ok, JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(true);
});

test("TypeScript implementations retain extension substitution priority", async () => {
  const { result, module } = await fixture({
    "vendor/package.json": '{"type":"module"}',
    "vendor/lib.d.ts": "export declare function make():number;",
    "vendor/lib.ts": "export function make():number{return 4;}",
    "vendor/lib.js": 'throw new Error("stale JS");export function make(){return 0;}',
    "main.ts": 'import {make} from "./vendor/lib.js";console.log(make());',
  });
  expect(result.ok, JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(true);
  expect(JSON.stringify(module)).not.toContain("stale JS");
});

test("import type queries do not select JavaScript sidecars", async () => {
  const { result, module } = await fixture({
    "vendor/package.json": '{"type":"module"}',
    "vendor/lib.d.mts": "export interface Item { value:number }",
    "vendor/lib.mjs": 'throw new Error("type query runtime");export const unrelated=0;',
    "main.ts":
      'type Item=import("./vendor/lib.mjs").Item;const item:Item={value:9};console.log(item.value);',
  });
  expect(result.ok, JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(true);
  expect(JSON.stringify(module)).not.toContain("type query runtime");
});

test("authored declaration checking does not root implementation-only diagnostics", async () => {
  const { result } = await fixture({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        allowJs: true,
        noImplicitReturns: true,
      },
      files: ["main.ts"],
    }),
    "vendor/package.json": '{"type":"module"}',
    "vendor/lib.d.mts": "export declare function make(value:boolean):number|undefined;",
    "vendor/lib.mjs": "export function make(value){if(value)return 3;}",
    "main.ts": 'import {make} from "./vendor/lib.mjs";console.log(make(true));',
  });
  expect(result.ok, JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(true);
});

test("inline type specifiers preserve the runtime import edge", async () => {
  const { result, module } = await fixture({
    "vendor/package.json": '{"type":"module"}',
    "vendor/lib.d.mts": "export interface Item { value:number }",
    "vendor/lib.mjs": 'console.log("inline type initialized");export const marker=1;',
    "main.ts":
      'import {type Item} from "./vendor/lib.mjs";const item:Item={value:9};console.log(item.value);',
  });
  expect(result.ok, JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(true);
  expect(JSON.stringify(module)).toContain("inline type initialized");
});

test("JSX authored checking retains relative declaration contracts", async () => {
  const { result } = await fixture(
    {
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          allowJs: true,
          jsx: "react",
          jsxFactory: "h",
          verbatimModuleSyntax: true,
        },
        files: ["main.tsx"],
      }),
      "vendor/package.json": '{"type":"module"}',
      "vendor/lib.d.mts": "export declare function make(value:number):number;",
      "vendor/lib.mjs": "export function make(value){return 3;}",
      "main.tsx":
        'import {make} from "./vendor/lib.mjs";function h(_tag:string,props:{value:number}){return props.value;}declare global{namespace JSX{interface IntrinsicElements{thing:{value:number}}}}console.log(<thing value={make("bad")} />);',
    },
    "main.tsx",
  );
  expect(result.ok).toBe(false);
  expect(
    (result.ok ? [] : result.diagnostics)?.some(
      (d) =>
        d.code === "SC0001" && d.message.includes("not assignable to parameter of type 'number'"),
    ),
  ).toBe(true);
});

const bundledCounter = {
  "node_modules/counter-api/package.json": JSON.stringify({
    name: "counter-api",
    version: "1.0.0",
    type: "module",
    exports: { ".": { types: "./index.d.ts", import: "./index.js" } },
  }),
  "node_modules/counter-api/index.d.ts":
    "export declare class Counter { static create(n: number): Counter; readonly value: number; }",
  "node_modules/counter-api/index.js":
    "export class Counter { static create(n) { return {value: n + 1000}; } }",
  "vendor/counter.d.mts": 'export {Counter} from "counter-api";',
  "vendor/counter.mjs":
    "class Local { constructor(n) { this.value=n; } static create(n) { return new Local(n); } } export { Local as Counter };",
};

test("a bundled class can supply the type of an instance field", async () => {
  const { result } = await fixture({
    ...bundledCounter,
    "main.ts":
      'import {Counter} from "./vendor/counter.mjs"; class Local { #state: Counter; constructor(n:number){this.#state=Counter.create(n);} get value(){return this.#state.value;} } console.log(new Local(42).value);',
  });
  expect(result.ok, JSON.stringify(result.ok ? [] : result.diagnostics)).toBe(true);
});

test("bundled declarations still check the published argument type", async () => {
  const { result } = await fixture({
    ...bundledCounter,
    "main.ts":
      'import {Counter} from "./vendor/counter.mjs"; console.log(Counter.create("wrong"));',
  });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(
      result.diagnostics.some((d) => d.code === "SC0001" && d.message.includes("number")),
    ).toBe(true);
  }
});
