import * as ts from "../../ts7/adapter.js";
import {
  BOOL,
  DYN,
  STRING,
  VOID,
  type IrExpr,
  type IrFunction,
  type IrStmt,
} from "../../../ir/ir.js";
import { nodeThrowExpr, varRef } from "../../../ir/build.js";
import { locOf } from "../../program.js";
import type { Lowerer } from "../lowerer.js";
import { recordLinksInto, recordLinkTest, registerLinkedHelper } from "../record-links.js";
import { keyedHelperName } from "../stable-names.js";

/** Optional fields can commit absence through their live checked view.
 * Kept sources and width copies remain fenced: mutating a composed view
 * would not prove that every typed alias observes the write. */
export function lowerReflectRecordDelete(
  lowerer: Lowerer,
  call: ts.CallExpression,
  target: IrExpr,
): IrExpr | null {
  if (target.type.kind !== "record") return null;
  let operand = call.arguments.nodes[0]!;
  while (ts.isParenthesizedExpression(operand)) operand = operand.expression;
  if (
    ts.isAsExpression(operand) ||
    ts.isTypeAssertion(operand) ||
    ts.isNonNullExpression(operand) ||
    ts.isSatisfiesExpression(operand)
  )
    return null;
  const type = target.type;
  const shape = lowerer.shapes.get(type.shapeId);
  const loc = locOf(call);
  if (
    !shape ||
    shape.tuple ||
    shape.indexValue ||
    shape.fields.length === 0 ||
    shape.fields.some((field) => lowerer.absentFieldValue(field, loc) === null)
  )
    return null;
  const keyValue = lowerer.lowerExpr(call.arguments.nodes[1]!);
  if (!lowerer.dynConvertible(keyValue.type)) return null;
  const cacheKey = `obj.reflectDelete:${type.shapeId}`;
  let name = lowerer.arrHofHelpers.get(cacheKey);
  if (name === undefined) {
    name = keyedHelperName(lowerer, "%obj.reflectDelete", cacheKey);
    lowerer.arrHofHelpers.set(cacheKey, name);
    const object = varRef("record", type, loc),
      rawKey = varRef("rawKey", DYN, loc);
    const key = varRef("key", DYN, loc),
      view = varRef("view", DYN, loc);
    const refuseStorage = (): IrExpr =>
      nodeThrowExpr(
        0,
        "SC1090",
        "Reflect.deleteProperty on a record with a retained source or copied view is not supported yet",
        BOOL,
        loc,
      );
    const primitive = (
      ["number", "string", "boolean", "undefined", "null", "bigint", "symbol"] as const
    )
      .map((test): IrExpr => ({ kind: "dynTest", test, value: rawKey, type: BOOL, loc }))
      .reduce((left, right): IrExpr => ({
        kind: "logical",
        op: "||",
        left,
        right,
        type: BOOL,
        loc,
      }));
    const named = shape.fields
      .map((field): IrExpr => ({
        kind: "strEq",
        negated: false,
        left: { kind: "dynCheck", value: key, type: STRING, loc },
        right: { kind: "strLit", value: field.name, type: STRING, loc },
        type: BOOL,
        loc,
      }))
      .reduce((left, right): IrExpr => ({
        kind: "logical",
        op: "||",
        left,
        right,
        type: BOOL,
        loc,
      }));
    const declaredKey: IrExpr = {
      kind: "logical",
      op: "&&",
      left: { kind: "dynTest", test: "string", value: key, type: BOOL, loc },
      right: named,
      type: BOOL,
      loc,
    };
    const body: IrStmt[] = [
      {
        kind: "if",
        cond: { kind: "unary", op: "!", operand: primitive, type: BOOL, loc },
        then: [
          {
            kind: "return",
            value: nodeThrowExpr(
              0,
              "SC1090",
              "Reflect.deleteProperty on a native record with an object key is not supported yet",
              BOOL,
              loc,
            ),
            loc,
          },
        ],
        else_: [],
        loc,
      },
      {
        kind: "varDecl",
        localId: "key",
        init: { kind: "libCall", fn: "dyn.propertyKey", args: [rawKey], type: DYN, loc },
        loc,
      },
      {
        kind: "if",
        cond: {
          kind: "logical",
          op: "&&",
          left: { kind: "libCall", fn: "record.sourceHas", args: [object], type: BOOL, loc },
          right: { kind: "unary", op: "!", operand: declaredKey, type: BOOL, loc },
          type: BOOL,
          loc,
        },
        then: [{ kind: "return", value: refuseStorage(), loc }],
        else_: [],
        loc,
      },
      {
        kind: "varDecl",
        localId: "view",
        init: { kind: "dynFrom", value: object, liveRef: true, type: DYN, loc },
        loc,
      },
      {
        kind: "exprStmt",
        expr: {
          kind: "libCall",
          fn: "dyn.keyDeleteComputed",
          args: [view, key, { kind: "boolLit", value: false, type: BOOL, loc }],
          type: VOID,
          loc,
        },
        loc,
      },
      {
        kind: "return",
        value: {
          kind: "unary",
          op: "!",
          operand: {
            kind: "libCall",
            fn: "dyn.hasOwnComputed",
            args: [view, key],
            type: BOOL,
            loc,
          },
          type: BOOL,
          loc,
        },
        loc,
      },
    ];
    const fn: IrFunction = {
      name,
      params: [
        { localId: "record", name: "record", type },
        { localId: "rawKey", name: "rawKey", type: DYN },
      ],
      returnType: BOOL,
      locals: [
        { id: "record", name: "record", type, mutable: false },
        { id: "rawKey", name: "rawKey", type: DYN, mutable: false },
        { id: "key", name: "key", type: DYN, mutable: false },
        { id: "view", name: "view", type: DYN, mutable: false },
      ],
      body,
      loc,
    };
    lowerer.liftedFns.push(fn);
    registerLinkedHelper(lowerer, fn, type.shapeId, "custom");
    lowerer.linkedHelperFinalizers.push((_sourced, checked) => {
      if (checked.has(type.shapeId)) {
        fn.body = [
          {
            kind: "return",
            value: nodeThrowExpr(
              0,
              "SC1090",
              "Reflect.deleteProperty on a record type reachable through a checked conversion is not supported yet",
              BOOL,
              loc,
            ),
            loc,
          },
        ];
        return;
      }
      fn.body = [
        ...recordLinksInto(lowerer, type.shapeId).map((link): IrStmt => ({
          kind: "if",
          cond: recordLinkTest(object, link, loc),
          then: [{ kind: "return", value: refuseStorage(), loc }],
          else_: [],
          loc,
        })),
        ...body,
      ];
    });
  }
  const receiver = lowerer.declareHiddenLocal("%reflectRecord", type);
  const key = lowerer.declareHiddenLocal("%reflectRawKey", DYN);
  return {
    kind: "seqExpr",
    stmts: [
      { kind: "varDecl", localId: receiver.id, init: target, loc },
      { kind: "varDecl", localId: key.id, init: lowerer.coerceToExpected(keyValue, DYN), loc },
    ],
    result: {
      kind: "call",
      callee: name,
      args: [varRef(receiver.id, type, loc), varRef(key.id, DYN, loc)],
      type: BOOL,
      loc,
    },
    type: BOOL,
    loc,
  };
}
