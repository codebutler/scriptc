import * as ts from "../ts7/adapter.js";
import type { Lowerer } from "./lowerer.js";
import type { ClassInfo } from "./lower-classes.js";
import {
  privateFieldName,
  privateMemberDeclaration,
  privateMemberName,
} from "./private-field-names.js";

/** Own-generic methods and static private names retain their existing policy. */
export function privateInstanceMethod(name: ts.PropertyName): ts.MethodDeclaration | null {
  if (!ts.isPrivateIdentifier(name)) return null;
  const member = privateMemberDeclaration(name);
  return member &&
    ts.isMethodDeclaration(member) &&
    !member.typeParameters &&
    !ts.getModifiers(member)?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)
    ? member
    : null;
}

/** A private method is lexically selected, never an override of a namesake. */
export function privateMethodName(lowerer: Lowerer, name: ts.MemberName): string {
  return ts.isPrivateIdentifier(name) && privateInstanceMethod(name)
    ? privateMemberName(lowerer, name)
    : name.text;
}

/** Calls and class-field disambiguation must preserve the field namespace too. */
export function privateInstanceMemberName(lowerer: Lowerer, name: ts.MemberName): string {
  const field = privateFieldName(lowerer, name);
  return field !== name.text ? field : privateMethodName(lowerer, name);
}

/** Collision policy asks source declarations, not already-qualified layout
 * keys. A generic family's duplicate declaration is not a base redeclaration. */
export function privateAncestorMember(
  base: ClassInfo | null,
  current: ts.ClassLikeDeclaration,
  name: string,
): { owner: ClassInfo; member: ts.ClassElement; name: ts.PrivateIdentifier } | null {
  for (let owner = base; owner; owner = owner.base) {
    if (!owner.decl || owner.decl === current) continue;
    const member = owner.decl.members.nodes.find(
      (member) =>
        member.name !== undefined &&
        ts.isPrivateIdentifier(member.name) &&
        member.name.text === name &&
        !ts.getModifiers(member)?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword),
    );
    if (member?.name && ts.isPrivateIdentifier(member.name))
      return { owner, member, name: member.name };
  }
  return null;
}
