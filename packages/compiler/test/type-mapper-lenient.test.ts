import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { loadProgram } from "../src/frontend/program-node.js";
import * as ts from "../src/frontend/ts7/adapter.js";
import {
  mapType,
  noteScopeSensitiveMapping,
  ShapeRegistry,
  UnionRegistry,
  type TypeMapperCtx,
} from "../src/frontend/type-mapper.js";
import { type IrType } from "../src/ir/ir.js";

let directory: string;
let load: ReturnType<typeof loadProgram>;
const aliases = new Map<string, ts.Type>();

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "scriptc-mapper-lenient-"));
  const entry = join(directory, "input.ts");
  const layers = Array.from(
    { length: 10 },
    (_, i) => `type D${i + 1} = { left: D${i}; right: D${i} };`,
  );
  const deep = Array.from({ length: 65 }, (_, i) => `type Deep${i + 1} = { next: Deep${i} };`);
  const failedLayers = Array.from(
    { length: 10 },
    (_, i) => `type Failed${i + 1}<T> = { left: Failed${i}<T>; right: Failed${i}<T> };`,
  );
  writeFileSync(
    entry,
    `
      type D0 = { value: number };
      ${layers.join("\n")}
      export type Diamond = D10;
      type Failed0<T> = { stable: number; bad: T };
      ${failedLayers.join("\n")}
      export type FailedDiamond<T> = Failed10<T>;
      type FailedLoop<T> = { next: FailedLoop<T>; field: Failed0<T> };
      export type ReusedFailure<T> = { first: { child: Failed0<T> }; second: FailedLoop<T> };
      type Deep0 = { value: number };
      ${deep.join("\n")}
      export type Depths = { deep: Deep65; shallow: Deep0 };
      export type Generic<T> = { left: T; right: T };
      export type Recursive = { value: number; children: Recursive[] };
      export type RecursivePair = { left: Recursive; right: Recursive };
      export type RecursiveGeneric<T> = { next: RecursiveGeneric<T>; value: T };
      export type RecursiveContexts<T> = {
        left: RecursiveGeneric<T>;
        right: { inner: RecursiveGeneric<T> };
      };
      export type RecursiveUnion<T> = { next: RecursiveUnion<T>; value: T } | { end: true };
      export type UnionContexts<T> = {
        left: RecursiveUnion<T>;
        right: { inner: RecursiveUnion<T> };
      };
      export const empty = {};
    `,
  );
  load = loadProgram(entry);
  ts.walkPreorder(load.entry, (node) => {
    if (ts.isTypeAliasDeclaration(node))
      aliases.set(node.name.text, load.program.getTypeChecker().getTypeAtLocation(node.type));
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
      aliases.set(
        node.name.text,
        load.program.getTypeChecker().getTypeAtLocation(node.initializer),
      );
  });
});

afterAll(() => {
  load?.dispose();
  if (directory) rmSync(directory, { recursive: true, force: true });
});

function context(): TypeMapperCtx {
  return {
    checker: load.program.getTypeChecker(),
    shapes: new ShapeRegistry(),
    unions: new UnionRegistry(),
    classNamer: (decl) => decl.name?.text ?? "anonymous",
    isStdlibFile: (sf) => load.program.isSourceFileDefaultLibrary(sf),
    isNpmFile: () => false,
    isExternalTypeFile: () => false,
    isProgramFile: (sf) => load.moduleOrder.includes(sf),
    lenient: true,
    canMemoizeType: () => false,
  };
}

function fields(result: IrType | null, ctx: TypeMapperCtx) {
  if (result?.kind !== "record") throw new Error("Expected a record");
  return ctx.shapes.get(result.shapeId)!.fields;
}

function mapped(name: string, ctx: TypeMapperCtx) {
  return mapType(aliases.get(name)!, ctx);
}

test("lenient traversal maps a shared record DAG without expanding every path", () => {
  const ctx = context();
  const checker = ctx.checker;
  const original = checker.getTypeOfSymbol;
  let reads = 0;
  checker.getTypeOfSymbol = (symbol) => {
    reads++;
    return original.call(checker, symbol);
  };
  let result: IrType | null;
  let firstReads: number;
  try {
    result = mapped("Diamond", ctx);
    firstReads = reads;
    reads = 0;
    expect(mapped("Diamond", ctx)).toEqual(result);
  } finally {
    checker.getTypeOfSymbol = original;
  }
  // Eleven distinct records, with two edges at each non-leaf level. A
  // diamond's repeated paths must not turn this into thousands of reads.
  expect(reads).toBeGreaterThan(0);
  expect(reads).toBe(firstReads);
  expect(reads).toBeLessThan(100);
  for (let depth = 10; depth > 0; depth--) {
    const members = fields(result, ctx);
    expect(members.map((field) => field.name)).toEqual(["left", "right"]);
    expect(members[0]!.type).toEqual(members[1]!.type);
    result = members[0]!.type;
  }
  expect(fields(result, ctx)).toMatchObject([{ name: "value", type: { kind: "f64" } }]);
});

test("repeated degraded pieces still notify every occurrence", () => {
  const ctx = context();
  const degraded: ts.Type[] = [];
  ctx.resolveTypeParam = () => null;
  ctx.onLenientPiece = (type) => degraded.push(type);
  expect(mapped("Generic", ctx)).toEqual({ kind: "dyn" });
  expect(degraded).toHaveLength(2);
  expect(degraded[0]).toBe(degraded[1]);
});

test("binding-sensitive pieces are read again inside a traversal and across roots", () => {
  const ctx = context();
  let resolutions = 0;
  ctx.resolveTypeParam = () => (++resolutions % 2 === 1 ? { kind: "string" } : { kind: "f64" });
  for (let root = 0; root < 2; root++) {
    expect(fields(mapped("Generic", ctx), ctx).map((field) => field.type)).toEqual([
      { kind: "string" },
      { kind: "f64" },
    ]);
  }
  expect(resolutions).toBe(4);
});

test("a scope-sensitive null resolution cannot mask a later binding", () => {
  const ctx = context();
  let resolutions = 0;
  ctx.resolveTypeParam = () => {
    noteScopeSensitiveMapping();
    return ++resolutions === 1 ? null : { kind: "string" };
  };
  expect(fields(mapped("Generic", ctx), ctx).map((field) => field.type)).toEqual([
    { kind: "dyn" },
    { kind: "string" },
  ]);
  expect(resolutions).toBe(2);
});

test("recursive records retain the same finalized shape at repeated edges", () => {
  const ctx = context();
  const pair = fields(mapped("RecursivePair", ctx), ctx);
  expect(pair[0]!.type).toEqual(pair[1]!.type);
  const recursive = fields(pair[0]!.type, ctx);
  expect(recursive.find((field) => field.name === "value")).toMatchObject({
    name: "value",
    type: { kind: "f64" },
  });
  expect(recursive.find((field) => field.name === "children")).toMatchObject({
    name: "children",
    type: { kind: "array", elem: pair[0]!.type },
  });
});

test("temporary empty-literal mapping does not leak between root calls", () => {
  const ctx = context();
  expect(mapped("empty", ctx)).toEqual({ kind: "dyn" });
  ctx.emptyLiteralArm = true;
  expect(fields(mapped("empty", ctx), ctx)).toEqual([]);
  ctx.emptyLiteralArm = false;
  expect(mapped("empty", ctx)).toEqual({ kind: "dyn" });
});

test("depth-limit recovery does not replace a shallower occurrence", () => {
  const ctx = context();
  const degraded: ts.Type[] = [];
  ctx.onLenientPiece = (type) => degraded.push(type);
  const root = fields(mapped("Depths", ctx), ctx);
  const shallow = root.find((field) => field.name === "shallow")!;
  expect(fields(shallow.type, ctx)).toMatchObject([{ name: "value", type: { kind: "f64" } }]);
  expect(degraded.length).toBeGreaterThan(0);
});

test("a failed recursive owner cannot leave a cached provisional child shape", () => {
  const ctx = context();
  ctx.resolveTypeParam = () => null;
  expect(mapped("RecursiveContexts", ctx)).toEqual({ kind: "dyn" });
});

test("a failed recursive union cannot leave a cached provisional child union", () => {
  const ctx = context();
  ctx.resolveTypeParam = () => null;
  expect(mapped("UnionContexts", ctx)).toEqual({ kind: "dyn" });
});

test("a once collector reuses degraded DAGs and preserves the mapped layout", () => {
  const legacy = context();
  const every: ts.Type[] = [];
  legacy.onLenientPiece = (type) => every.push(type);
  const expected = mapped("FailedDiamond", legacy);
  expect(every).toHaveLength(1024);
  expect(new Set(every).size).toBe(1);

  const ctx = context();
  const once: ts.Type[] = [];
  ctx.onLenientPieceOnce = (type) => once.push(type);
  const original = ctx.checker.getTypeOfSymbol;
  let reads = 0;
  ctx.checker.getTypeOfSymbol = (symbol) => {
    reads++;
    return original.call(ctx.checker, symbol);
  };
  try {
    expect(mapped("FailedDiamond", ctx)).toEqual(expected);
  } finally {
    ctx.checker.getTypeOfSymbol = original;
  }
  expect(reads).toBeLessThan(100);
  expect(once).toEqual([every[0]]);
  expect(ctx.shapes.shapes).toEqual(legacy.shapes.shapes);
});

test("the per-occurrence hook takes precedence over a once collector", () => {
  const ctx = context();
  let every = 0;
  let once = 0;
  ctx.onLenientPiece = () => every++;
  ctx.onLenientPieceOnce = () => once++;
  expect(mapped("FailedDiamond", ctx)?.kind).toBe("record");
  expect(every).toBe(1024);
  expect(once).toBe(0);
});

test("a throwing once collector leaves no reusable completed entry or notification", () => {
  const ctx = context();
  const failure = new Error("collector failure");
  let calls = 0;
  ctx.onLenientPieceOnce = () => {
    if (++calls === 1) throw failure;
  };
  let caught: unknown;
  try {
    mapped("FailedDiamond", ctx);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(mapped("FailedDiamond", ctx)?.kind).toBe("record");
  expect(calls).toBe(2);
});

test("a reused degradation still prevents recursive-owner finalization", () => {
  const legacy = context();
  const every = new Set<ts.Type>();
  legacy.onLenientPiece = (type) => every.add(type);
  const expected = mapped("ReusedFailure", legacy);
  expect(fields(expected, legacy).find((field) => field.name === "second")?.type).toEqual({
    kind: "dyn",
  });
  const ctx = context();
  const once = new Set<ts.Type>();
  ctx.onLenientPieceOnce = (type) => once.add(type);
  expect(mapped("ReusedFailure", ctx)).toEqual(expected);
  expect(once).toEqual(every);
});

test("once collection does not hide a scope change after an unbound parameter", () => {
  const ctx = context();
  const once: ts.Type[] = [];
  let resolutions = 0;
  ctx.onLenientPieceOnce = (type) => once.push(type);
  ctx.resolveTypeParam = () => {
    noteScopeSensitiveMapping();
    return ++resolutions === 1 ? null : { kind: "string" };
  };
  expect(fields(mapped("Generic", ctx), ctx).map((field) => field.type)).toEqual([
    { kind: "dyn" },
    { kind: "string" },
  ]);
  expect(resolutions).toBe(2);
  expect(once).toHaveLength(1);
});

test("once notification happens at the first failed leaf before the next field", () => {
  const ctx = context();
  const order: string[] = [];
  ctx.onLenientPieceOnce = () => order.push("piece");
  const original = ctx.checker.getTypeOfSymbol;
  ctx.checker.getTypeOfSymbol = (symbol) => {
    order.push("field:" + ts.symbolName(symbol));
    return original.call(ctx.checker, symbol);
  };
  try {
    expect(mapped("Generic", ctx)).toEqual({ kind: "dyn" });
  } finally {
    ctx.checker.getTypeOfSymbol = original;
  }
  expect(order).toEqual(["field:left", "piece", "field:right"]);
});
