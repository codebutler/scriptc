import * as ts from "../ts7/adapter.js";
import { isJsSourceFile } from "../program.js";
import type { Lowerer } from "./lowerer.js";
import { hasExplicitJsDocReturn } from "./function-returns.js";
import {
  hasJsTypeAnnotation,
  jsBindingHasOpenWrites,
  jsObjectBindingHasOpenFieldWrites,
} from "./lower-stmts.js";

/** A value originating in a fresh JS object whose initializer-inferred
 * shape cannot describe later writes. Follow that evidence through reads,
 * unannotated bindings and returns;
 * explicit TS and JSDoc contracts remain conversion boundaries. */
export function openJsValue(lowerer: Lowerer, expr: ts.Expression): boolean {
  if (!isJsSourceFile(ts.getSourceFileOfNode(expr))) return false;
  return query(lowerer, expr, () => {
    if (ts.isParenthesizedExpression(expr) || ts.isAwaitExpression(expr))
      return openJsValue(lowerer, expr.expression);
    if (ts.isIdentifier(expr)) {
      const parent = expr.parent;
      const decl =
        parent &&
        (ts.isVariableDeclaration(parent) || ts.isBindingElement(parent)) &&
        parent.name === expr
          ? parent
          : lowerer.resolveValueSymbol(expr)?.valueDeclaration;
      return decl !== undefined && openBinding(lowerer, decl);
    }
    if (ts.isPropertyAccessExpression(expr) || ts.isElementAccessExpression(expr))
      return unannotatedMember(lowerer, expr) && openJsValue(lowerer, expr.expression);
    if (ts.isCallExpression(expr)) {
      const decl = lowerer.checker.getResolvedSignature(expr)?.declaration;
      if (
        decl &&
        (!isJsSourceFile(ts.getSourceFileOfNode(decl)) ||
          decl.type ||
          (ts.isFunctionLike(decl) && hasExplicitJsDocReturn(decl)))
      )
        return false;
      if (
        ts.isPropertyAccessExpression(expr.expression) ||
        ts.isElementAccessExpression(expr.expression)
      ) {
        if (openJsValue(lowerer, expr.expression)) return true;
      } else if (openJsValue(lowerer, expr.expression)) return true;
      return (
        decl !== undefined &&
        (ts.isFunctionDeclaration(decl) ||
          ts.isFunctionExpression(decl) ||
          ts.isArrowFunction(decl) ||
          ts.isMethodDeclaration(decl)) &&
        returnsOpenJsValue(lowerer, decl)
      );
    }
    if (ts.isConditionalExpression(expr))
      return openJsValue(lowerer, expr.whenTrue) || openJsValue(lowerer, expr.whenFalse);
    if (
      ts.isBinaryExpression(expr) &&
      (expr.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        expr.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    )
      return openJsValue(lowerer, expr.left) || openJsValue(lowerer, expr.right);
    return false;
  });
}

/** A receiver-wide write does not erase a contract on an individual member.
 * Use the checker declaration, before this proof widens receiver reads. */
function unannotatedMember(
  lowerer: Lowerer,
  expr: ts.PropertyAccessExpression | ts.ElementAccessExpression,
): boolean {
  const key = ts.isPropertyAccessExpression(expr)
    ? expr.name.text
    : expr.argumentExpression &&
        (ts.isStringLiteralLike(expr.argumentExpression) ||
          ts.isNumericLiteral(expr.argumentExpression))
      ? expr.argumentExpression.text
      : null;
  if (key === null) return false;
  const symbol = lowerer.checker.getPropertyOfType(
    lowerer.checker.getTypeAtLocation(expr.expression),
    key,
  );
  return !(
    symbol?.declarations.some(
      (decl) =>
        !isJsSourceFile(ts.getSourceFileOfNode(decl)) ||
        decl.type ||
        ts.sourceTextRangeMatches(
          ts.getSourceFileOfNode(decl),
          decl.pos,
          ts.tokenStartOfNode(decl),
          /@(?:type|param|returns?)\b/,
          ts.LEADING_SPAN,
        ),
    ) ?? false
  );
}

function openBinding(lowerer: Lowerer, decl: ts.Node): boolean {
  let root: ts.Node | undefined = decl;
  while (root && ts.isBindingElement(root) && root.parent && ts.isBindingPattern(root.parent))
    root = root.parent.parent;
  if (
    !root ||
    !ts.isVariableDeclaration(root) ||
    root.type ||
    hasJsTypeAnnotation(root) ||
    !isJsSourceFile(ts.getSourceFileOfNode(root))
  )
    return false;
  return query(
    lowerer,
    root,
    () =>
      (root.initializer !== undefined &&
        ts.isObjectLiteralExpression(root.initializer) &&
        jsBindingHasOpenWrites(lowerer, root)) ||
      jsObjectBindingHasOpenFieldWrites(lowerer, root) ||
      (root.initializer !== undefined && openJsValue(lowerer, root.initializer)),
  );
}

export function returnsOpenJsValue(lowerer: Lowerer, decl: ts.SignatureDeclaration): boolean {
  if (
    !isJsSourceFile(ts.getSourceFileOfNode(decl)) ||
    decl.type ||
    decl.asteriskToken ||
    hasExplicitJsDocReturn(decl)
  )
    return false;
  return query(lowerer, decl, () => {
    if (ts.isArrowFunction(decl) && decl.body && !ts.isBlock(decl.body))
      return openJsValue(lowerer, decl.body);
    let found = false;
    const scan = (node: ts.Node): void => {
      if (found || (node !== decl && ts.isFunctionLike(node))) return;
      if (ts.isReturnStatement(node) && node.expression)
        found = openJsValue(lowerer, node.expression);
      ts.forEachChild(node, scan);
    };
    scan(decl);
    return found;
  });
}

/** Cache only established evidence. A recursive edge is not evidence, but
 * caching its provisional false answer would hide a later return in a
 * mutually recursive function. */
function query(lowerer: Lowerer, node: ts.Node, compute: () => boolean): boolean {
  if (lowerer.openJsValues.has(node)) return true;
  if (lowerer.openJsValueQueries.has(node)) return false;
  lowerer.openJsValueQueries.add(node);
  try {
    const answer = compute();
    if (answer) lowerer.openJsValues.add(node);
    return answer;
  } finally {
    lowerer.openJsValueQueries.delete(node);
  }
}
