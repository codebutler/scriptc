/* The mutable-buffers fact (t262-dc §2.4): a JavaScript source that can
 * change an ArrayBuffer's length or detach it — `new ArrayBuffer(len, {
 * maxByteLength })`, or a read of `transfer`, `transferToFixedLength`,
 * `resize` or `grow` on any receiver. The name match is deliberate: the
 * receiver may be a checked-dynamic value, and a false positive costs only
 * the invariant metadata of that one program.
 *
 * The fact sets IrModule.bytesHeadersMutable (the backend drops
 * `!invariant.load` on bytes headers and stops proving lengths across
 * calls) and arms scr_js_buffers's views registry in %main, which is what
 * selects the unit's runtime feature. Programs without it keep their exact
 * IR and runtime objects. */
import { VOID, type IrFunction } from "../../ir/ir.js";
import * as ts from "../ts7/adapter.js";
import { isWorkerConstructor } from "../worker-target.js";
import {
  isBuiltinMemberImport,
  isBuiltinNamespaceImport,
  isNodeGlobal,
  staticForkString,
} from "../fork-target.js";
import { canonicalBuiltinModule } from "../builtin-modules.js";
import { ENTRY_NAME } from "./lowerer.js";

/** Member names whose call can change a buffer's length or detach it. */
export const MUTABLE_BUFFER_MEMBERS: ReadonlySet<string> = new Set([
  "transfer",
  "transferToFixedLength",
  "resize",
  "grow",
]);

/** Only a worker-capable graph needs the unknown-key fallback. Computed
 * require cannot load new native modules; its runtime path refuses them. */
function hasWorkerCapability(program: ts.Program, sources: ts.SourceFile[]): boolean {
  const checker = program.getTypeChecker();
  let found = false;
  const strip = (node: ts.Expression): ts.Expression => {
    while (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isNonNullExpression(node)
    )
      node = node.expression;
    return node;
  };
  const builtin = (expression: ts.Expression, module: string, member: string): boolean => {
    const node = strip(expression);
    if (ts.isIdentifier(node)) return isBuiltinMemberImport(program, node, module, member);
    return (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === member &&
      ts.isIdentifier(node.expression) &&
      isBuiltinNamespaceImport(program, node.expression, module)
    );
  };
  const loader = (expression: ts.Expression, seen = new Set<ts.Symbol>()): boolean => {
    const node = strip(expression);
    if (ts.isCallExpression(node)) return builtin(node.expression, "module", "createRequire");
    if (!ts.isIdentifier(node)) return false;
    if (node.text === "require" && isNodeGlobal(program, node)) return true;
    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol || seen.has(symbol)) return false;
    seen.add(symbol);
    return symbol.declarations.some(
      (declaration) =>
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer !== undefined &&
        loader(declaration.initializer, seen),
    );
  };
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      canonicalBuiltinModule(node.moduleSpecifier.text) === "worker_threads"
    ) {
      found = true;
    } else if (
      ts.isIdentifier(node) &&
      (node.text === "MessageChannel" || node.text === "MessagePort") &&
      isNodeGlobal(program, node)
    ) {
      found = true;
    } else if (ts.isCallExpression(node)) {
      const id = node.arguments.nodes[0];
      const specifier = id ? staticForkString(program, id) : null;
      if (specifier !== null && canonicalBuiltinModule(specifier) === "worker_threads") {
        const callee = strip(node.expression);
        const processGlobal =
          ts.isPropertyAccessExpression(callee) &&
          callee.name.text === "getBuiltinModule" &&
          ts.isIdentifier(strip(callee.expression)) &&
          (strip(callee.expression) as ts.Identifier).text === "process" &&
          isNodeGlobal(program, strip(callee.expression) as ts.Identifier);
        found = loader(callee) || processGlobal || builtin(callee, "process", "getBuiltinModule");
      }
    }
    if (!found) ts.forEachChild(node, visit);
  };
  for (const source of sources) visit(source);
  return found;
}

/** Establish worker detachment before lowering any function or byte loop.
 * A method can escape through an alias, so a non-call read is conservative;
 * direct postMessage calls without a transfer argument keep fixed headers. */
export function hasWorkerBufferTransfers(program: ts.Program, sources: ts.SourceFile[]): boolean {
  let found = false;
  const checker = program.getTypeChecker();
  const workerCapability = hasWorkerCapability(program, sources);
  const empty = (node: ts.Expression): boolean =>
    node.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(node) &&
      node.text === "undefined" &&
      (isNodeGlobal(program, node) ||
        !program.getTypeChecker().getSymbolAtLocation(node)?.declarations.length)) ||
    (ts.isVoidExpression(node) && ts.isNumericLiteral(node.expression)) ||
    (ts.isArrayLiteralExpression(node) && node.elements.nodes.length === 0);
  const name = (node: ts.Node | undefined): string | null => {
    if (!node) return null;
    if (ts.isComputedPropertyName(node)) return name(node.expression);
    return ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text : null;
  };
  const computedPostMessage = (node: ts.ElementAccessExpression): boolean => {
    const key = node.argumentExpression;
    if (!key) return false;
    if (ts.isStringLiteralLike(key)) return key.text === "postMessage";
    if (ts.isNumericLiteral(key)) return false;
    const keyType = checker.getTypeAtLocation(key);
    if (keyType.isStringLiteralType()) return keyType.value === "postMessage";
    if (!workerCapability) return false;
    if (keyType.flags & (ts.TypeFlags.NumberLike | ts.TypeFlags.ESSymbolLike)) return false;
    // An admitted dynamic key may name postMessage. Only callable or
    // unknown values can escape as a method; numeric/string data reads
    // do not require mutable byte headers.
    const valueType = checker.getTypeAtLocation(node);
    return (
      (valueType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.TypeParameter)) !==
        0 || checker.getSignaturesOfType(valueType, ts.SignatureKind.Call).length > 0
    );
  };
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      if (
        ts.isPropertyAccessExpression(node)
          ? name(node.name) === "postMessage"
          : computedPostMessage(node)
      ) {
        const parent = node.parent;
        found =
          !ts.isCallExpression(parent) ||
          parent.expression !== node ||
          (parent.arguments.nodes.length > 1 && !empty(parent.arguments.nodes[1]!)) ||
          parent.arguments.nodes.some(ts.isSpreadElement);
      }
    } else if (
      ts.isBindingElement(node) &&
      name(node.propertyName ?? node.name) === "postMessage"
    ) {
      found = true;
    } else if (ts.isNewExpression(node)) {
      const options = node.arguments?.nodes[1];
      if (options && !empty(options)) {
        const possible =
          !ts.isObjectLiteralExpression(options) ||
          options.properties.nodes.some(
            (property) =>
              ts.isSpreadAssignment(property) ||
              (name(property.name) === "transferList" &&
                !(ts.isPropertyAssignment(property) && empty(property.initializer))),
          );
        found = possible && isWorkerConstructor(program, node.expression);
      }
    }
    if (!found) ts.forEachChild(node, visit);
  };
  for (const source of sources) visit(source);
  return found;
}

/** Installs the registry arming call at the top of %main; answers whether
 * the program has an entry function to carry it. The fact itself
 * (lowerer.buffersMutable) is complete by the time a program is assembled:
 * every member read and every resizable construction has been lowered. */
export function installMutableBuffersArm(functions: IrFunction[]): boolean {
  const main = functions.find((fn) => fn.name === ENTRY_NAME);
  if (!main) return false;
  main.body.unshift({
    kind: "exprStmt",
    expr: {
      kind: "libCall",
      fn: "arrayBuffer.armMutable",
      args: [],
      type: VOID,
      loc: main.loc,
    },
    loc: main.loc,
  });
  return true;
}
