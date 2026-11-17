import * as ts from "../ts7/adapter.js";
import type { Lowerer } from "./lowerer.js";
import { keyedHelperName } from "./stable-names.js";

/** Private names resolve to the nearest enclosing declaration, independently
 * of the receiver's runtime class or generic specialization. */
export function privateMemberDeclaration(name: ts.PrivateIdentifier): ts.ClassElement | null {
  for (let node: ts.Node | undefined = name.parent; node; node = node.parent) {
    if (!ts.isClassDeclaration(node) && !ts.isClassExpression(node)) continue;
    const member = node.members.nodes.find(
      (member) =>
        member.name !== undefined &&
        ts.isPrivateIdentifier(member.name) &&
        member.name.text === name.text,
    );
    if (member) return member;
  }
  return null;
}

/** Declaration identity for construction analysis, including private methods
 * and accessors: an inherited private helper never calls a derived namesake. */
export function privateMemberName(lowerer: Lowerer, name: ts.PrivateIdentifier): string {
  const member = privateMemberDeclaration(name);
  if (!member) return name.text;
  return keyedHelperName(
    lowerer,
    `#private:${name.text}`,
    JSON.stringify([
      lowerer.pathOf(ts.getSourceFileOfNode(member)),
      ts.tokenStartOfNode(member),
      name.text,
    ]),
  );
}

export function privateInstanceField(
  name: ts.PropertyName,
  lowerer?: Lowerer,
): ts.PropertyDeclaration | null {
  if (!ts.isPrivateIdentifier(name)) return null;
  const member = privateMemberDeclaration(name);
  if (!member || !ts.isPropertyDeclaration(member)) return null;
  if (
    ts
      .getModifiers(member)
      ?.some(
        (m) => m.kind === ts.SyntaxKind.StaticKeyword || m.kind === ts.SyntaxKind.AccessorKeyword,
      )
  )
    return null;
  const init = member.initializer;
  if (
    init &&
    (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) &&
    init.typeParameters &&
    (!lowerer ||
      lowerer.checker
        .getCallSignatures(lowerer.typeOf(member.name))
        .some((sig) => sig.getTypeParameters()?.length))
  )
    return null;
  return member;
}

/** Storage is shared by specializations of the same declaration; the
 * receiver's own layout supplies the specialized type and slot offset. */
export function privateFieldName(lowerer: Lowerer, name: ts.MemberName): string {
  return ts.isPrivateIdentifier(name) && privateInstanceField(name, lowerer)
    ? privateMemberName(lowerer, name)
    : name.text;
}
