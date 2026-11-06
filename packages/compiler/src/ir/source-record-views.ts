import type { IrExpr, IrModule, IrRecordShape, IrType, IrUnionDef } from "./ir.js";
import { typeKey } from "./ir.js";
import { everyStmtList } from "./traverse.js";

/** Whether a structural API object exposes a function, directly or through
 * another record. Pure-data assertions retain their existing lowering. */
export function recordGraphHasFunction(
  type: IrType,
  record: (id: string) => IrRecordShape | undefined,
  union: (id: string) => IrUnionDef | undefined,
): boolean {
  const seen = new Set<string>();
  const visit = (current: IrType): boolean => {
    const key = typeKey(current);
    if (seen.has(key)) return false;
    seen.add(key);
    if (current.kind === "func") return true;
    if (current.kind === "record")
      return record(current.shapeId)?.fields.some((field) => visit(field.type)) ?? false;
    if (current.kind === "union") return union(current.unionId)?.arms.some(visit) ?? false;
    return false;
  };
  return type.kind === "record" && visit(type);
}

/** The dynamic-source form of partialView, distinct from a live native
 * record literal asserted to a wider native layout. */
export function isSourceRecordView(expr: IrExpr): boolean {
  return (
    expr.kind === "dynCheck" &&
    expr.partialView === true &&
    expr.type.kind === "record" &&
    !(expr.value.kind === "dynFrom" && expr.value.value.type.kind === "record")
  );
}

/** Records whose view may own an arbitrary dynamic source. Their hidden
 * source edge participates in cycle analysis just like a dynamic field. */
export function sourceRecordViewTargets(mod: IrModule): Set<string> {
  const records = new Map((mod.records ?? []).map((record) => [record.id, record]));
  const unions = new Map((mod.unions ?? []).map((union) => [union.id, union]));
  const targets = new Set<string>();
  const seen = new Set<string>();
  const visit = (type: IrType): void => {
    const key = typeKey(type);
    if (seen.has(key)) return;
    seen.add(key);
    if (type.kind === "record") {
      targets.add(type.shapeId);
      for (const field of records.get(type.shapeId)?.fields ?? []) visit(field.type);
    } else if (type.kind === "union") {
      for (const arm of unions.get(type.unionId)?.arms ?? []) visit(arm);
    } else if (type.kind === "func") {
      for (const parameter of type.params) visit(parameter);
      visit(type.ret);
    }
  };
  for (const fn of mod.functions)
    everyStmtList(fn.body, {
      stmt: () => true,
      expr: (expr) => {
        if (isSourceRecordView(expr)) visit(expr.type);
        return true;
      },
    });
  return targets;
}
