import type { IrExpr, IrType } from "../../../ir/ir.js";
import {
  BOOL,
  canAdaptDynFuncTo,
  canBoxFuncIntoDyn,
  DYN,
  isUnitType,
  typeEquals,
  VOID,
} from "../../../ir/ir.js";
import { keyedHelperName } from "../stable-names.js";
import type { Lowerer } from "../lowerer.js";

type FunctionType = IrType & { kind: "func" };
type UnionType = IrType & { kind: "union" };

function voidView(lowerer: Lowerer, from: FunctionType, target: UnionType): FunctionType | null {
  if (from.rest === true || from.argumentsAll === true || from.argumentsPresence === true)
    return null;
  const arms = lowerer.unions.get(target.unionId)?.arms ?? [];
  const functions = arms.filter((arm) => arm.kind === "func");
  const views = functions.filter((arm) => arm.ret.kind === "void");
  const view = views.length === 1 ? views[0] : undefined;
  if (
    !view ||
    functions.length < 2 ||
    !arms.some(isUnitType) ||
    !arms.every(
      (arm) =>
        isUnitType(arm) ||
        (arm.kind === "func" && typeEquals({ ...arm, ret: VOID }, { ...from, ret: VOID })),
    )
  )
    return null;
  const shape = (id: string) => lowerer.shapes.get(id);
  const union = (id: string) => lowerer.unions.get(id);
  return canBoxFuncIntoDyn(from, shape, union) && canAdaptDynFuncTo(view, shape, union)
    ? view
    : null;
}

/** Keep the original callable behind a checked void view: native void
 * adapters would discard its result before a union call could recover it. */
export function callableUnionConversion(
  lowerer: Lowerer,
  value: IrExpr,
  target: UnionType,
): IrExpr | null {
  if (value.type.kind === "func") {
    const view = voidView(lowerer, value.type, target);
    if (!view) return null;
    const boxed = lowerer.coerceToExpected(value, DYN);
    const checked = lowerer.coerceToExpected(boxed, view);
    if (boxed.type.kind !== "dyn" || !typeEquals(checked.type, view)) return null;
    return {
      kind: "unionWrap",
      unionId: target.unionId,
      tag: lowerer.armTag(target.unionId, view),
      value: checked,
      type: target,
      loc: value.loc,
    };
  }
  if (value.type.kind !== "union") return null;
  const source = value.type;
  const arms = lowerer.unions.get(source.unionId)?.arms ?? [];
  const functions = arms.filter((arm) => arm.kind === "func");
  const from = functions.length === 1 ? functions[0] : undefined;
  if (
    !from ||
    !voidView(lowerer, from, target) ||
    !arms.every(
      (arm) => arm === from || (isUnitType(arm) && lowerer.armTag(target.unionId, arm) >= 0),
    )
  )
    return null;
  const key = `nullableCallable:${source.unionId}:${target.unionId}`;
  let name = lowerer.coercions.retags.get(key);
  if (!name) {
    name = keyedHelperName(lowerer, "%union.callable", key);
    const loc = value.loc;
    const ref: IrExpr = { kind: "varRef", localId: "u.0", type: source, loc };
    const narrowed: IrExpr = {
      kind: "unionNarrow",
      unionId: source.unionId,
      tag: arms.indexOf(from),
      value: ref,
      type: from,
      loc,
    };
    let result = callableUnionConversion(lowerer, narrowed, target);
    if (!result) return null;
    for (const [tag, arm] of arms.entries()) {
      if (!isUnitType(arm)) continue;
      const unit: IrExpr = {
        kind: "unitLit",
        unit: arm.kind === "undefinedT" ? "undefined" : "null",
        type: arm,
        loc,
      };
      result = {
        kind: "ternary",
        cond: {
          kind: "unionIsTag",
          unionId: source.unionId,
          tag,
          negated: false,
          value: ref,
          type: BOOL,
          loc,
        },
        then: {
          kind: "unionWrap",
          unionId: target.unionId,
          tag: lowerer.armTag(target.unionId, arm),
          value: unit,
          type: target,
          loc,
        },
        else_: result,
        type: target,
        loc,
      };
    }
    lowerer.coercions.retags.set(key, name);
    lowerer.liftedFns.push({
      name,
      params: [{ localId: "u.0", name: "u", type: source }],
      returnType: target,
      locals: [{ id: "u.0", name: "u", type: source, mutable: false }],
      body: [{ kind: "return", value: result, loc }],
      loc,
    });
  }
  return { kind: "call", callee: name, args: [value], type: target, loc: value.loc };
}
