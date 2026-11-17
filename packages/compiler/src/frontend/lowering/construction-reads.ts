/* Fields that construction can read before their assignment.
 *
 * While an instance is under construction, the fields its constructor has
 * not assigned yet hold undefined in Node, and so does every field of a
 * derived class while a base constructor runs. tsc checks only the reads a
 * constructor makes itself. A method the constructor calls through `this`
 * is not checked, and neither is the override a derived class supplies for
 * a method its base constructor calls:
 *
 *   class Base { constructor() { this.init(); } init(): void {} }
 *   class Derived extends Base {
 *     size = 5;
 *     init(): void { console.log(this.size); }   // undefined in Node
 *   }
 *
 * constructionReads answers which fields of a class such code can read
 * before their assignment. It walks construction in the order it runs (the
 * bases' constructors and field initializers, then the class's own field
 * initializers in declaration order, then its constructor's statements)
 * and follows every `this.name` and `super.name` to the methods and
 * accessors of that name declared by the class, its bases and its
 * descendants (the override that runs is one of them). A field is read
 * early when one of those methods reads it and the call that reaches the
 * method runs no later than the field's own initializer or top-level
 * constructor assignment. Every other field keeps its plain slot.
 *
 * A callback that captures the instance (an arrow function written in that
 * code) is followed as if it ran where it is written. An instance handed
 * to other code as a value (`register(this)`, `new Helper(this)`) is not
 * followed: what that code reads of it is not visible here. */
import * as ts from "../ts7/adapter.js";
import { extendsElementOf } from "../heritage-elements.js";

/** The classes of a program by base class. */
export interface ClassHierarchy {
  /** The program classes that directly extend a class declaration. */
  readonly derived: ReadonlyMap<ts.Node, readonly ts.ClassLikeDeclaration[]>;
  /** Classes whose base is computed (`extends mixin(Base)`) or does not
   * resolve to a declaration: each may extend any class of the program. */
  readonly open: readonly ts.ClassLikeDeclaration[];
}

/** The class declaration a heritage expression names, null for a class the
 * program does not declare (a runtime or library class), or undefined when
 * the base cannot be named statically. */
export type BaseResolver = (heritage: ts.Expression) => ts.ClassLikeDeclaration | null | undefined;

function extendsExpressionOf(decl: ts.ClassLikeDeclaration): ts.Expression | undefined {
  return extendsElementOf(decl)?.expression;
}

export function classHierarchyOf(
  sourceFiles: readonly ts.SourceFile[],
  resolveBase: BaseResolver,
): ClassHierarchy {
  const derived = new Map<ts.Node, ts.ClassLikeDeclaration[]>();
  const open: ts.ClassLikeDeclaration[] = [];
  for (const sf of sourceFiles) {
    if (sf.isDeclarationFile || !sf.text.includes("extends")) continue;
    ts.walkPreorder(sf, (node) => {
      if (!ts.isClassDeclaration(node) && !ts.isClassExpression(node)) return undefined;
      const heritage = extendsExpressionOf(node);
      if (heritage === undefined) return undefined;
      const base = resolveBase(heritage);
      if (base === undefined) open.push(node);
      else if (base !== null) {
        const list = derived.get(base);
        if (list) list.push(node);
        else derived.set(base, [node]);
      }
      return undefined;
    });
  }
  return { derived, open };
}

/** Every class that can be the class of an instance `decl`'s constructor
 * runs for, besides `decl` itself. */
function descendantsOf(
  hierarchy: ClassHierarchy,
  decl: ts.ClassLikeDeclaration,
): ts.ClassLikeDeclaration[] {
  const seen = new Set<ts.Node>([decl]);
  const out: ts.ClassLikeDeclaration[] = [];
  const pending: ts.ClassLikeDeclaration[] = [decl, ...hierarchy.open];
  while (pending.length > 0) {
    const next = pending.pop()!;
    if (next !== decl) {
      if (seen.has(next)) continue;
      seen.add(next);
      out.push(next);
    }
    for (const child of hierarchy.derived.get(next) ?? []) pending.push(child);
  }
  return out;
}

export interface ConstructionReads {
  /** Whether construction can read the class's field `name` through `this`
   * before the field's assignment. */
  early(name: string): boolean;
  /** Private access (including writes) before the field declaration has
   * installed its brand. A bare declaration still installs undefined. */
  beforePrivateInitialization(name: string): boolean;
}

/** Whether `node` is a nested function or class with a receiver of its
 * own: its `this` is not the instance under construction. An arrow
 * function keeps the receiver. */
function bindsReceiver(node: ts.Node): boolean {
  return (
    (ts.isFunctionLike(node) && !ts.isArrowFunction(node)) ||
    ts.isClassDeclaration(node) ||
    ts.isClassExpression(node)
  );
}

function insideArrow(node: ts.Node, root: ts.Node): boolean {
  for (let n = node.parent; n !== undefined && n !== root; n = n.parent)
    if (ts.isArrowFunction(n)) return true;
  return false;
}

function isPlainWriteTarget(access: ts.Node): boolean {
  let target = access;
  while (
    target.parent !== undefined &&
    ts.isParenthesizedExpression(target.parent) &&
    target.parent.expression === target
  )
    target = target.parent;
  const parent = target.parent;
  return (
    parent !== undefined &&
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    parent.left === target
  );
}

/** Whether the member access `node` can run the method it names: a call
 * calls it, `.call`, `.apply` or `.bind` is taken of it, or it is an
 * argument of a call, which may invoke it. A method that is only read or
 * stored is handed on without running. */
function mayRun(node: ts.Node): boolean {
  let value = node;
  while (
    value.parent !== undefined &&
    (ts.isParenthesizedExpression(value.parent) || ts.isNonNullExpression(value.parent))
  )
    value = value.parent;
  const parent = value.parent;
  if (parent === undefined) return false;
  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) return true;
  if (ts.isTaggedTemplateExpression(parent)) return parent.tag === value;
  return (
    ts.isPropertyAccessExpression(parent) &&
    parent.expression === value &&
    (parent.name.text === "call" || parent.name.text === "apply" || parent.name.text === "bind")
  );
}

function isStatic(member: ts.ClassElement): boolean {
  return ts.getModifiers(member)?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ?? false;
}

function memberNameOf(
  member: ts.ClassElement,
  privateName: (name: ts.PrivateIdentifier) => string,
): string | null {
  const name = member.name;
  return name !== undefined &&
    (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name))
    ? ts.isPrivateIdentifier(name)
      ? privateName(name)
      : name.text
    : null;
}

/** The field a top-level constructor statement assigns (`this.x = e;`). */
function assignedFieldOf(
  statement: ts.Statement,
  privateName: (name: ts.PrivateIdentifier) => string,
): string | null {
  if (
    !ts.isExpressionStatement(statement) ||
    !ts.isBinaryExpression(statement.expression) ||
    statement.expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken
  )
    return null;
  const target = statement.expression.left;
  return ts.isPropertyAccessExpression(target) &&
    target.expression.kind === ts.SyntaxKind.ThisKeyword
    ? ts.isPrivateIdentifier(target.name)
      ? privateName(target.name)
      : target.name.text
    : null;
}

/** Erased syntax cannot hide a private access to the constructing receiver. */
function privateReceiver(expression: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertion(expression) ||
    ts.isNonNullExpression(expression)
  )
    expression = expression.expression;
  return expression;
}

/** Direct lexical arrows retained by a fresh private aggregate. Opaque
 * expressions keep the eager/conservative walk: no factory, spread, accessor
 * or computed-key evaluation is certified as mere callback storage. */
function privateLiteralCallbacks(initializer: ts.Expression): ts.ArrowFunction[] | null {
  const unwrap = (value: ts.Expression): ts.Expression => {
    while (
      ts.isParenthesizedExpression(value) ||
      ts.isAsExpression(value) ||
      ts.isTypeAssertion(value) ||
      ts.isNonNullExpression(value) ||
      ts.isSatisfiesExpression(value)
    )
      value = value.expression;
    return value;
  };
  const root = unwrap(initializer);
  if (!ts.isObjectLiteralExpression(root) && !ts.isArrayLiteralExpression(root)) return null;
  const callbacks: ts.ArrowFunction[] = [];
  const collect = (expression: ts.Expression): boolean => {
    const value = unwrap(expression);
    if (ts.isArrowFunction(value)) {
      callbacks.push(value);
      return true;
    }
    if (ts.isObjectLiteralExpression(value)) {
      for (const property of value.properties.nodes) {
        if (
          !ts.isPropertyAssignment(property) ||
          ts.isComputedPropertyName(property.name) ||
          !collect(property.initializer)
        )
          return false;
      }
      return true;
    }
    if (ts.isArrayLiteralExpression(value)) {
      for (const element of value.elements.nodes) {
        if (ts.isSpreadElement(element) || !collect(element)) return false;
      }
      return true;
    }
    return (
      ts.isIdentifier(value) ||
      ts.isLiteralExpression(value) ||
      value.kind === ts.SyntaxKind.TrueKeyword ||
      value.kind === ts.SyntaxKind.FalseKeyword ||
      value.kind === ts.SyntaxKind.NullKeyword ||
      value.kind === ts.SyntaxKind.ThisKeyword ||
      value.kind === ts.SyntaxKind.OmittedExpression
    );
  };
  return collect(root) ? callbacks : null;
}

/** The fields of `decl` that the construction of an instance of `decl` (or
 * of a class derived from it) can read through `this` before they are
 * assigned. `bases` are `decl`'s base class declarations, nearest first.
 * The constructors' own direct reads are not included: tsc rejects one
 * that comes before the assignment. */
export function constructionReads(
  decl: ts.ClassLikeDeclaration,
  bases: readonly ts.ClassLikeDeclaration[],
  hierarchy: ClassHierarchy,
  privateName: (name: ts.PrivateIdentifier) => string = (name) => name.text,
): ConstructionReads {
  // What running `this.name` runs (a method, or a field holding a
  // function, which a call runs with the instance as its receiver) and
  // what any `this.name` access runs (an accessor).
  const calledByName = new Map<string, ts.Node[]>();
  const accessedByName = new Map<string, ts.Node[]>();
  const privateLiteralBodies = new Map<string, ts.Node[]>();
  const retainedArrows = new Set<ts.ArrowFunction>();
  const add = (table: Map<string, ts.Node[]>, name: string, body: ts.Node): void => {
    const list = table.get(name);
    if (list) list.push(body);
    else table.set(name, [body]);
  };
  for (const owner of [decl, ...bases, ...descendantsOf(hierarchy, decl)]) {
    for (const member of owner.members.nodes) {
      const name = memberNameOf(member, privateName);
      if (name === null || isStatic(member)) continue;
      if (ts.isAccessor(member)) {
        if (member.body) add(accessedByName, name, member.body);
      } else if (ts.isMethodDeclaration(member)) {
        if (member.body) add(calledByName, name, member.body);
      } else if (
        ts.isPropertyDeclaration(member) &&
        member.initializer &&
        (ts.isArrowFunction(member.initializer) || ts.isFunctionExpression(member.initializer))
      )
        add(calledByName, name, member.initializer.body);
      if (
        ts.isPropertyDeclaration(member) &&
        ts.isPrivateIdentifier(member.name) &&
        member.initializer
      ) {
        for (const callback of privateLiteralCallbacks(member.initializer) ?? []) {
          retainedArrows.add(callback);
          add(privateLiteralBodies, name, callback.body);
        }
      }
    }
  }
  // The step of construction at which each member was first read by a
  // method construction had called by then, and the step of the first
  // computed `this[key]` read, which can name any member.
  const readAt = new Map<string, number>();
  const privateAccessAt = new Map<string, number>();
  let anyAt = Infinity;
  let step = 0;
  const entered = new Set<ts.Node>();
  const enter = (bodies: readonly ts.Node[] | undefined): void => {
    for (const body of bodies ?? []) {
      if (entered.has(body)) continue;
      entered.add(body);
      scan(body, true);
    }
  };
  // `called`: the code runs through a `this` call, so tsc has not checked
  // its reads; a constructor's or an initializer's own reads are checked.
  // An arrow function written in either is a callback that captures the
  // instance: the code it is handed to may call it at once
  // (`items.forEach((item) => this.add(item))`), so it counts as called
  // where it is written. A field initialized with a function only creates
  // it: it runs when something calls it by name.
  const scan = (root: ts.Node, called: boolean): void => {
    if (!called && (ts.isArrowFunction(root) || bindsReceiver(root))) return;
    ts.walkPreorder(root, (node) => {
      if (node !== root && bindsReceiver(node)) return "skip";
      if (ts.isArrowFunction(node) && retainedArrows.has(node)) return "skip";
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.InKeyword &&
        ts.isPrivateIdentifier(node.left)
      ) {
        const receiver = privateReceiver(node.right);
        if (receiver.kind === ts.SyntaxKind.ThisKeyword) {
          const name = privateName(node.left);
          if (!privateAccessAt.has(name)) privateAccessAt.set(name, step);
        }
      }
      if (ts.isPropertyAccessExpression(node) && ts.isPrivateIdentifier(node.name)) {
        const receiver = privateReceiver(node.expression);
        if (
          receiver.kind === ts.SyntaxKind.ThisKeyword ||
          receiver.kind === ts.SyntaxKind.SuperKeyword
        ) {
          const name = privateName(node.name);
          if (!privateAccessAt.has(name)) privateAccessAt.set(name, step);
          // Reading the private aggregate can invoke or publish any of its
          // callbacks. A plain write only replaces it, without reading the
          // previous callbacks. Wrapped receivers follow this same path.
          if (!isPlainWriteTarget(node)) enter(privateLiteralBodies.get(name));
        }
      }
      if (
        (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) ||
        (node.expression.kind !== ts.SyntaxKind.ThisKeyword &&
          node.expression.kind !== ts.SyntaxKind.SuperKeyword)
      )
        return undefined;
      const name = ts.isPropertyAccessExpression(node)
        ? ts.isPrivateIdentifier(node.name)
          ? privateName(node.name)
          : node.name.text
        : ts.isStringLiteralLike(node.argumentExpression)
          ? node.argumentExpression.text
          : null;
      const write = isPlainWriteTarget(node);
      if (name === null) {
        if (!write) anyAt = Math.min(anyAt, step);
        return undefined;
      }
      if ((called || insideArrow(node, root)) && !write && !readAt.has(name))
        readAt.set(name, step);
      enter(accessedByName.get(name));
      if (mayRun(node)) enter(calledByName.get(name));
      return undefined;
    });
  };
  const constructionOf = (
    owner: ts.ClassLikeDeclaration,
  ): { initializers: ts.PropertyDeclaration[]; statements: readonly ts.Statement[] } => {
    const initializers: ts.PropertyDeclaration[] = [];
    let statements: readonly ts.Statement[] = [];
    for (const member of owner.members.nodes) {
      if (ts.isConstructorDeclaration(member) && member.body)
        statements = member.body.statements.nodes;
      else if (ts.isPropertyDeclaration(member) && !isStatic(member)) initializers.push(member);
    }
    return { initializers, statements };
  };
  // Step 0: everything the bases' construction runs comes before any field
  // of this class is assigned.
  for (const base of bases) {
    const { initializers, statements } = constructionOf(base);
    for (const member of initializers) if (member.initializer) scan(member.initializer, false);
    for (const statement of statements) scan(statement, false);
  }
  // Then the class's own initializers in declaration order and its
  // constructor's statements, one step each. A field is assigned at the
  // step of its initializer or of its top-level `this.x = e;` statement.
  const assignedAt = new Map<string, number>();
  const privateInitializedAt = new Map<string, number>();
  const own = constructionOf(decl);
  for (const member of own.initializers) {
    step++;
    if (member.initializer) scan(member.initializer, false);
    const name = memberNameOf(member, privateName);
    if (name !== null) {
      if (member.initializer) assignedAt.set(name, step);
      if (ts.isPrivateIdentifier(member.name)) privateInitializedAt.set(name, step);
    }
  }
  for (const statement of own.statements) {
    step++;
    scan(statement, false);
    const name = assignedFieldOf(statement, privateName);
    if (name !== null && !assignedAt.has(name)) assignedAt.set(name, step);
  }
  return {
    beforePrivateInitialization: (name) => {
      const access = privateAccessAt.get(name);
      const initialized = privateInitializedAt.get(name);
      return access !== undefined && initialized !== undefined && access <= initialized;
    },
    early: (name) => {
      const read = Math.min(name.startsWith("#") ? Infinity : anyAt, readAt.get(name) ?? Infinity);
      return read !== Infinity && read <= (assignedAt.get(name) ?? Infinity);
    },
  };
}
