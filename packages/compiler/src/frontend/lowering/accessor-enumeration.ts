import type { IrExpr, IrFunction, IrRecordShape, IrStmt, IrType } from "../../ir/ir.js";
import { F64, STRING, typeEquals, typeKey } from "../../ir/ir.js";
import { locOf } from "../program.js";
import type * as ts from "../ts7/adapter.js";
import type { Lowerer } from "./lowerer.js";
import { keyedHelperName } from "./stable-names.js";

/** Enumerate fixed accessor records without snapshotting their data values.
 * The key-order pass must prove every producer has the same closed key set.
 * Data writes by an earlier getter are therefore read at the later key's turn. */
export function lowerAccessorEnumeration(
  lowerer: Lowerer,
  call: ts.CallExpression,
  member: "keys" | "values" | "entries",
  recordT: IrType & { kind: "record" },
  shape: IrRecordShape,
): IrExpr {
  const loc = locOf(call);
  const refuse: (reason: string) => never = (reason) =>
    lowerer.unsupported("SC1090", call, `Object.${member} over accessor records (${reason})`);
  if (shape.indexValue !== undefined || shape.tuple || shape.fields.some((f) => f.optional))
    refuse("only closed records with required keys have a static accessor walk");
  for (const field of shape.fields) {
    if (
      field.name.startsWith("%set:") &&
      !shape.fields.some((f) => f.name === `%get:${field.name.slice(5)}`)
    )
      refuse("setter-only properties retain the refusal");
    if (
      field.name.startsWith("%get:") &&
      (field.type.kind !== "func" ||
        field.type.params.length !== 0 ||
        field.type.rest !== undefined ||
        field.type.ret.kind === "void")
    )
      refuse("the getter needs an ordinary zero-argument value signature");
  }
  const resultT = lowerer.irTypeOf(call);
  if (resultT.kind !== "array") return refuse("the result needs a native array representation");
  const tupleT = member === "entries" && resultT.elem.kind === "record" ? resultT.elem : null;
  const tupleShape = tupleT === null ? undefined : lowerer.shapes.get(tupleT.shapeId);
  const valueT =
    member === "values"
      ? resultT.elem
      : member === "entries" && tupleShape?.tuple
        ? tupleShape.fields.find((f) => f.name === "1")?.type
        : STRING;
  if (valueT === undefined || (member === "entries" && tupleT === null) || valueT.kind === "dyn")
    return refuse("the result needs a typed element representation");
  const key = `accessor.${member}:${shape.id}:${typeKey(resultT)}`;
  let name = lowerer.arrHofHelpers.get(key);
  if (name === undefined) {
    name = keyedHelperName(lowerer, `%obj.accessor.${member}`, key);
    const receiver: IrExpr = { kind: "varRef", localId: "r.0", type: recordT, loc };
    const out: IrExpr = { kind: "varRef", localId: "out.0", type: resultT, loc };
    const fn: IrFunction = {
      name,
      params: [{ localId: "r.0", name: "r", type: recordT }],
      returnType: resultT,
      locals: [
        { id: "r.0", name: "r", type: recordT, mutable: false },
        { id: "out.0", name: "out", type: resultT, mutable: false },
      ],
      body: [],
      loc,
    };
    const finalize = (): void => {
      const current = lowerer.shapes.get(shape.id) ?? shape;
      const order = current.accessorOrder;
      if (order === undefined) refuse("the logical property order is unavailable");
      const body: IrStmt[] = [
        {
          kind: "varDecl",
          localId: "out.0",
          init: { kind: "arrayLit", elems: [], type: resultT, loc },
          loc,
        },
      ];
      for (const property of order) {
        let value: IrExpr = { kind: "strLit", value: property, type: STRING, loc };
        if (member !== "keys") {
          const getter = current.fields.find((f) => f.name === `%get:${property}`);
          const field = getter ?? current.fields.find((f) => f.name === property);
          if (field === undefined) refuse("a logical key has no native storage");
          const read: IrExpr = {
            kind: "recordGet",
            obj: receiver,
            shapeId: shape.id,
            field: field.name,
            type: field.type,
            loc,
          };
          if (getter !== undefined) {
            if (getter.type.kind !== "func") refuse("getter storage is not callable");
            value = { kind: "callValue", callee: read, args: [], type: getter.type.ret, loc };
          } else value = read;
          if (!typeEquals(value.type, valueT)) {
            if (valueT.kind !== "union")
              refuse("a property needs an unsupported result conversion");
            const tag = lowerer.armTag(valueT.unionId, value.type);
            if (tag < 0) refuse("a property has no exact result union arm");
            value = { kind: "unionWrap", unionId: valueT.unionId, tag, value, type: valueT, loc };
          }
        }
        const element: IrExpr =
          member !== "entries"
            ? value
            : {
                kind: "recordLit",
                fields: [
                  { name: "0", value: { kind: "strLit", value: property, type: STRING, loc } },
                  { name: "1", value },
                ],
                type: tupleT!,
                loc,
              };
        body.push({
          kind: "exprStmt",
          expr: {
            kind: "arrIntrinsic",
            method: "push",
            receiver: out,
            args: [element],
            type: F64,
            loc,
          },
          loc,
        });
      }
      body.push({ kind: "return", value: out, loc });
      fn.body = body;
    };
    finalize();
    lowerer.arrHofHelpers.set(key, name);
    lowerer.shapeOrderHelperFinalizers.push(finalize);
    lowerer.liftedFns.push(fn);
  }
  const receiver = lowerer.lowerExpr(call.arguments.nodes[0]!);
  if (!typeEquals(receiver.type, recordT)) refuse("the receiver changed representation");
  return lowerer.keyOrder.accessorEnumeration(
    { kind: "call", callee: name, args: [receiver], type: resultT, loc },
    shape.id,
  );
}
