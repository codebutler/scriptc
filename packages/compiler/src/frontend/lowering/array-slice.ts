import * as ts from "../ts7/adapter.js";
import { numLit, varRef } from "../../ir/build.js";
import { F64, type IrExpr, type IrStmt, type IrType } from "../../ir/ir.js";
import { locOf } from "../program.js";
import type { Lowerer } from "./lowerer.js";
import { relativeIndex } from "./array-indexed-mutation.js";
import { positionNumber } from "./optional-arguments.js";

/** Dynamic bounds can run user code. Read the call's arguments before
 * taking the length snapshot, then convert both bounds against that length. */
export function lowerDynamicArraySlice(
  lowerer: Lowerer,
  call: ts.CallExpression,
  receiver: IrExpr,
  arrayType: IrType & { kind: "array" },
  positions: readonly [IrExpr, IrExpr],
): IrExpr {
  const loc = locOf(call);
  const stmts: IrStmt[] = [];
  const hold = (name: string, value: IrExpr): IrExpr => {
    const local = lowerer.declareHiddenLocal(name, value.type);
    stmts.push({ kind: "varDecl", localId: local.id, init: value, loc });
    return varRef(local.id, value.type, loc);
  };
  const source = hold("%sliceReceiver", receiver);
  let start: IrExpr = numLit(0, loc);
  let end: IrExpr = numLit(Infinity, loc);
  call.arguments.nodes.forEach((argument, index) => {
    if (ts.isSpreadElement(argument))
      lowerer.noLowering("array slice with a spread argument", argument);
    if (index < 2) {
      const value = hold("%sliceArgument", index === 0 ? positions[0] : positions[1]);
      if (index === 0) start = value;
      else end = value;
    } else {
      // Extra arguments are ignored by slice after their effects run.
      stmts.push({ kind: "exprStmt", expr: lowerer.lowerExpr(argument), loc });
    }
  });
  const length = hold("%sliceLength", {
    kind: "arrIntrinsic",
    method: "length",
    receiver: source,
    args: [],
    type: F64,
    loc,
  });
  const fromNumber = hold(
    "%sliceStartNumber",
    positionNumber(
      lowerer,
      start,
      numLit(0, loc),
      call.arguments.nodes[0] ?? call,
      "array slice start",
    ),
  );
  const from = hold("%sliceStart", relativeIndex(fromNumber, length, loc));
  const toNumber = hold(
    "%sliceEndNumber",
    positionNumber(
      lowerer,
      end,
      numLit(Infinity, loc),
      call.arguments.nodes[1] ?? call,
      "array slice end",
    ),
  );
  const to = hold("%sliceEnd", relativeIndex(toNumber, length, loc));
  const result = hold("%sliceResult", {
    kind: "arrIntrinsic",
    method: "slice",
    receiver: source,
    args: [from, to],
    type: arrayType,
    loc,
  });
  // Native slice preserves slot states and shallow references. If bound
  // conversion shortened the source, extend its surviving prefix with holes
  // to the count determined from the original length. Growth is excluded by
  // the already-normalized upper bound.
  stmts.push({
    kind: "arraySetLength",
    arr: result,
    length: {
      kind: "libCall",
      fn: "math.max",
      args: [{ kind: "bin", op: "-", left: to, right: from, type: F64, loc }, numLit(0, loc)],
      type: F64,
      loc,
    },
    loc,
  });
  return { kind: "seqExpr", stmts, result, type: arrayType, loc };
}
