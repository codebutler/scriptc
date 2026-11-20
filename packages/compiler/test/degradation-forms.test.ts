import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { loadProgram, checkPreflight } from "../src/frontend/program-node.js";
import { Lowerer, PoisonError } from "../src/frontend/lowering/lowerer.js";
import * as ts from "../src/frontend/ts7/adapter.js";
import type { IrType, IrFunction } from "../src/ir/ir.js";
import type { TypeFailureSlot } from "../src/diagnostics/diagnostic.js";
import { recordUnit, recordApplies, type WaveHost } from "../src/frontend/lowering/unit-journal.js";

const source = `type Message=undefined|null|boolean|number|string|ArrayBuffer|readonly Message[]|{readonly[key:string]:Message};
type Field<T>={value:T;callback:(message:Message)=>T};
function* sequence(){yield 1;}
type GeneratorField<T>={value:T;items:ReturnType<typeof sequence>[]};
class Model<T>{field!:Field<T>;plain!:{value:T};generators!:GeneratorField<T>;}
export {};`;
function model() {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-degradation-forms-"));
  const entry = join(dir, "model.ts");
  writeFileSync(entry, source);
  const load = loadProgram(entry);
  expect(checkPreflight(load)).toEqual([]);
  const checker = load.program.getTypeChecker();
  const decl = load.entry.statements.nodes.find(ts.isClassDeclaration);
  if (!decl) throw new Error("missing Model");
  const parameter = decl.typeParameters?.nodes[0];
  if (!parameter) throw new Error("missing type parameter");
  const symbol = checker.getSymbolAtLocation(parameter.name);
  if (!symbol) throw new Error("missing parameter symbol");
  const field = decl.members.nodes.find(
    (member) =>
      ts.isPropertyDeclaration(member) &&
      ts.isIdentifier(member.name) &&
      member.name.text === "field",
  );
  const plain = decl.members.nodes.find(
    (member) =>
      ts.isPropertyDeclaration(member) &&
      ts.isIdentifier(member.name) &&
      member.name.text === "plain",
  );
  if (!field || !ts.isPropertyDeclaration(field) || !plain || !ts.isPropertyDeclaration(plain))
    throw new Error("missing fields");
  const lowerer = new Lowerer(load.program, load.entry, load.moduleOrder);
  const bind = (lower: Lowerer, name: "number" | "string") => {
    lower.typeParamBindings = new Map([[symbol, { kind: name === "number" ? "f64" : "string" }]]);
    lower.typeParamTsBindings = new Map([
      [symbol, name === "number" ? checker.getNumberType() : checker.getStringType()],
    ]);
  };
  return {
    load,
    lowerer,
    field,
    plain,
    decl,
    bind,
    close: () => {
      load.dispose();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
function idOf(type: ts.Type): number {
  const id = (type as { id?: number }).id;
  if (id === undefined) throw new Error("missing type id");
  return id;
}
function committed(lowerer: Lowerer, node: ts.Node, type: ts.Type): void {
  try {
    lowerer.badType(node, type);
  } catch (error) {
    if (!(error instanceof PoisonError)) throw error;
    const slot = lowerer.degradeAtCommit(error, new Set<TypeFailureSlot>(["field"]));
    if (!slot) throw new Error("failure did not commit");
    return;
  }
  throw new Error("badType did not throw");
}
function mapped(lowerer: Lowerer, type: ts.Type): IrType {
  const hook = lowerer.typeCtx.degradedType;
  if (!hook) throw new Error("missing degradation hook");
  const result = hook(type);
  if (!result) throw new Error("missing degraded form");
  return result;
}
function valueType(lowerer: Lowerer, type: IrType): IrType | undefined {
  return type.kind === "record"
    ? lowerer.shapes.get(type.shapeId)?.fields.find((field) => field.name === "value")?.type
    : undefined;
}
for (const order of [
  ["number", "string"],
  ["string", "number"],
] as const)
  test(`same symbolic callback field maps under ${order.join(" then ")}`, () => {
    const m = model();
    try {
      const type = m.lowerer.checker.getTypeAtLocation(m.field.name);
      m.bind(m.lowerer, order[0]);
      expect(m.lowerer.mapTypeOf(type)).toBeNull();
      committed(m.lowerer, m.field.name, type);
      for (const name of order) {
        m.bind(m.lowerer, name);
        const result = mapped(m.lowerer, type);
        expect(valueType(m.lowerer, result)).toEqual({
          kind: name === "number" ? "f64" : "string",
        });
        if (result.kind !== "record") throw new Error("missing record");
        const callback = m.lowerer.shapes
          .get(result.shapeId)
          ?.fields.find((f) => f.name === "callback")?.type;
        expect(callback).toMatchObject({
          kind: "func",
          params: [{ kind: "dyn" }],
          ret: { kind: name === "number" ? "f64" : "string" },
        });
      }
    } finally {
      m.close();
    }
  });
test("coverage remainder reconstructs form under its own bindings and registries", () => {
  const m = model();
  try {
    const type = m.lowerer.checker.getTypeAtLocation(m.field.name);
    m.bind(m.lowerer, "number");
    committed(m.lowerer, m.field.name, type);
    const other = new Lowerer(m.load.program, m.load.entry, m.load.moduleOrder, {
      degradedTypes: m.lowerer.degradedTypes,
    });
    m.bind(other, "string");
    expect(valueType(other, mapped(other, type))).toEqual({ kind: "string" });
    for (const recipe of other.degradedTypes.values()) {
      expect(recipe).not.toHaveProperty("lenient");
      expect(recipe).not.toHaveProperty("canonical");
    }
  } finally {
    m.close();
  }
});
test("canonical outcomes are recomputed, and canonical forms do not become dynamic slots", () => {
  const m = model();
  try {
    const type = m.lowerer.checker.getTypeAtLocation(m.plain.name);
    m.bind(m.lowerer, "number");
    committed(m.lowerer, m.plain.name, type);
    expect(m.lowerer.isCanonicalDegraded(idOf(type))).toBe(true);
    const other = new Lowerer(m.load.program, m.load.entry, m.load.moduleOrder, {
      degradedTypes: m.lowerer.degradedTypes,
    });
    m.bind(other, "string");
    expect(valueType(other, mapped(other, type))).toEqual({ kind: "string" });
    expect(other.isCanonicalDegraded(idOf(type))).toBe(true);
    other.noteDegradedSlot(m.plain.name, type);
    expect(other.dynamicSlots).toEqual([]);
  } finally {
    m.close();
  }
});
test("global existing escalation replaces an immutable decision and invalidates all binding forms", () => {
  const m = model();
  try {
    const type = m.lowerer.checker.getTypeAtLocation(m.field.name),
      id = idOf(type);
    m.bind(m.lowerer, "number");
    committed(m.lowerer, m.field.name, type);
    const prior = m.lowerer.degradedTypes.get(id);
    if (!prior) throw new Error("missing decision");
    const snapshot = JSON.stringify(prior);
    m.bind(m.lowerer, "string");
    expect(mapped(m.lowerer, type).kind).toBe("record");
    expect(m.lowerer.widenPartials(new Set([id]))).toBe(true);
    expect(m.lowerer.degradedTypes.get(id)).not.toBe(prior);
    expect(JSON.stringify(prior)).toBe(snapshot);
    expect(mapped(m.lowerer, type)).toEqual({ kind: "dyn" });
    m.bind(m.lowerer, "number");
    expect(mapped(m.lowerer, type)).toEqual({ kind: "dyn" });
  } finally {
    m.close();
  }
});
test("restoring an earlier decision restores its own context forms", () => {
  const m = model();
  try {
    const type = m.lowerer.checker.getTypeAtLocation(m.field.name),
      id = idOf(type);
    m.bind(m.lowerer, "number");
    committed(m.lowerer, m.field.name, type);
    const prior = m.lowerer.degradedTypes.get(id);
    if (!prior) throw new Error("missing decision");
    const before = mapped(m.lowerer, type);
    m.lowerer.widenPartials(new Set([id]));
    expect(mapped(m.lowerer, type)).toEqual({ kind: "dyn" });
    m.lowerer.degradedTypes.set(id, prior);
    expect(mapped(m.lowerer, type)).toEqual(before);
  } finally {
    m.close();
  }
});
test("a cached-form consumer cannot leave a replayable unit across a later upgrade", () => {
  const m = model();
  try {
    const type = m.lowerer.checker.getTypeAtLocation(m.field.name);
    m.bind(m.lowerer, "number");
    committed(m.lowerer, m.field.name, type);
    mapped(m.lowerer, type);
    const unitFunction: IrFunction = {
      name: "consumer",
      params: [],
      locals: [],
      returnType: { kind: "void" },
      body: [],
      loc: { file: m.load.entry.fileName, start: 0, end: 0 },
    };
    const host: WaveHost = {
      tables: m.lowerer.journalTables(),
      scalars: [],
      lowerRecorded: () => {
        mapped(m.lowerer, type);
        return { fn: unitFunction, poisoned: false };
      },
      store: () => {},
      statementCounts: () => ({ total: 0, failed: 0, other: 0 }),
      resolves: () => true,
      keep: () => {},
    };
    const unit = recordUnit(host, "consumer");
    m.lowerer.widenPartials(new Set([idOf(type)]));
    if (unit.record) expect(recordApplies(host, unit.record)).not.toEqual([]);
    expect(unit.record).toBeNull();
    expect(unit.reasons).toContain("degradedFormReads");
  } finally {
    m.close();
  }
});

function generatorField(m: ReturnType<typeof model>): ts.PropertyDeclaration {
  const member = m.decl.members.nodes.find(
    (member) =>
      ts.isPropertyDeclaration(member) &&
      ts.isIdentifier(member.name) &&
      member.name.text === "generators",
  );
  if (!member || !ts.isPropertyDeclaration(member)) throw new Error("missing generator field");
  return member;
}
test("repeated degradation keeps generator notes from every observed binding scope", () => {
  const m = model();
  try {
    const field = generatorField(m),
      type = m.lowerer.checker.getTypeAtLocation(field.name);
    m.bind(m.lowerer, "number");
    committed(m.lowerer, field.name, type);
    m.bind(m.lowerer, "string");
    mapped(m.lowerer, type);
    expect(m.lowerer.degradedGeneratorArrays()).toHaveLength(2);
    committed(m.lowerer, field.name, type);
    expect(m.lowerer.degradedGeneratorArrays()).toHaveLength(2);
    expect(mapped(m.lowerer, type)).toEqual({ kind: "dyn" });
  } finally {
    m.close();
  }
});
test("a new mode lazily regenerates generator notes in its own context", () => {
  const m = model();
  try {
    const field = generatorField(m),
      type = m.lowerer.checker.getTypeAtLocation(field.name);
    m.bind(m.lowerer, "number");
    committed(m.lowerer, field.name, type);
    const other = new Lowerer(m.load.program, m.load.entry, m.load.moduleOrder, {
      degradedTypes: m.lowerer.degradedTypes,
    });
    expect(other.degradedGeneratorArrays()).toEqual([]);
    m.bind(other, "string");
    mapped(other, type);
    expect(other.degradedGeneratorArrays()).toHaveLength(1);
    expect(valueType(other, mapped(other, type))).toEqual({ kind: "string" });
  } finally {
    m.close();
  }
});
