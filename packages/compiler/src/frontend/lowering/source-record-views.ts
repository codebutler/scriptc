import * as ts from "../ts7/adapter.js";
import { dynFallbackType, type Lowerer } from "./lowerer.js";
import { isJsSourceFile } from "../program.js";
import { type IrType, typeKey } from "../../ir/ir.js";
import { recordGraphHasFunction } from "../../ir/source-record-views.js";

const targets = new WeakMap<Lowerer, Set<string>>();

/** Find admitted API assertion graphs before lowering reflective folds.
 * The cache is installed first because mapping a type may query presence.
 * Pure-data and fresh literal assertions keep their existing lowering. */
export function sourceAssertionShapes(lowerer: Lowerer): ReadonlySet<string> {
  const known = targets.get(lowerer);
  if (known) return known;
  const found = new Set<string>();
  targets.set(lowerer, found);
  const seen = new Set<string>();
  const visit = (type: IrType): void => {
    const key = typeKey(type);
    if (seen.has(key)) return;
    seen.add(key);
    if (type.kind === "record") {
      found.add(type.shapeId);
      lowerer.keyOrder.keptSourceShapes.add(type.shapeId);
      for (const field of lowerer.shapes.get(type.shapeId)?.fields ?? []) visit(field.type);
    } else if (type.kind === "union") {
      for (const arm of lowerer.unions.get(type.unionId)?.arms ?? []) visit(arm);
    } else if (type.kind === "func") {
      for (const parameter of type.params) visit(parameter);
      visit(type.ret);
    }
  };
  for (const file of lowerer.program.getImplementationSourceFiles()) {
    if (isJsSourceFile(file)) continue;
    ts.walkPreorder(file, (node) => {
      if (!ts.isAsExpression(node) && !ts.isTypeAssertion(node)) return;
      let operand: ts.Expression = node.expression;
      while (ts.isParenthesizedExpression(operand)) operand = operand.expression;
      if (ts.isObjectLiteralExpression(operand) || ts.isArrayLiteralExpression(operand)) return;
      const sourceType = lowerer.typeOf(operand);
      const source = lowerer.mapTypeOf(sourceType) ?? dynFallbackType(lowerer, operand, sourceType);
      if (source?.kind !== "dyn") return;
      const target = lowerer.mapTypeOf(lowerer.checker.getTypeFromTypeNode(node.type));
      if (
        target &&
        recordGraphHasFunction(
          target,
          (id) => lowerer.shapes.get(id),
          (id) => lowerer.unions.get(id),
        )
      )
        visit(target);
    });
  }
  return found;
}
