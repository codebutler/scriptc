class Menu { value = 1; }
class Child extends Menu { extra = 2; }
class Other { value = 3; }
type Source = Menu | Other | number[] | (() => number[]) | undefined;
function factory(): number[] { return [4]; }
function check(value: Source): boolean { return value instanceof Menu; }
function checked(value: unknown): boolean { return value instanceof Menu; }
for (const value of [new Menu(), new Child(), new Other(), [1], factory, undefined]) {
  console.log("initial", check(value), checked(value));
}
console.log("before", check(factory), checked(factory));
Object.setPrototypeOf(factory, Menu.prototype);
console.log("changed", check(factory), checked(factory), factory()[0]);
Object.setPrototypeOf(factory, null);
console.log("removed", check(factory), checked(factory), factory()[0]);
const arrow = (): number[] => [5];
Object.setPrototypeOf(arrow, Child.prototype);
console.log("arrow", check(arrow), checked(arrow), arrow()[0]);
const chained = (): number[] => [6];
Object.setPrototypeOf(chained, arrow);
console.log("function chain", check(chained), checked(chained), chained()[0]);
Object.setPrototypeOf(arrow, null);
console.log("changed chain", check(chained), checked(chained));
function named():number[]{return [7];}
console.log("name", named.name, check(named), checked(named));
let reads = 0;
function getValue(): Source { reads++; return factory; }
console.log("once", check(getValue()), reads);
const sentinel = { marker: 42 };
function throwing(): Source { throw sentinel; }
try { check(throwing()); } catch (error) { console.log("throw", error === sentinel, reads); }
class Hook {
  static [Symbol.hasInstance](value: unknown): boolean {
    console.log("hook", typeof value);
    return typeof value === "function";
  }
}
function custom(value: Hook | number[] | (() => number[])): boolean { return value instanceof Hook; }
console.log("custom", custom(factory), custom([]));
let beforeReads = 0;
function earlyValue(): Late | (()=>number) { beforeReads++; return ()=>1; }
function earlyCheck(): boolean { return earlyValue() instanceof Late; }
try { console.log(earlyCheck()); } catch (error) { console.log("tdz", error instanceof ReferenceError, beforeReads); }
class Late { value = 1; }
console.log("initialized", earlyCheck(), beforeReads);
// An ordinary function reaches Function.prototype without an explicit
// override of its own. That shared link can itself acquire a class chain.
function ordinary(): number[] { return [8]; }
console.log("builtin tail before", check(ordinary), checked(ordinary), checked(Function.prototype));
Object.setPrototypeOf(Function.prototype, Menu.prototype);
const inheritedMixed = check(ordinary);
const inheritedChecked = checked(ordinary);
const functionPrototypeItself = checked(Function.prototype);
Object.setPrototypeOf(Function.prototype, null);
console.log("builtin tail changed", inheritedMixed, inheritedChecked, functionPrototypeItself);
console.log("builtin tail null", check(ordinary), checked(ordinary), checked(Function.prototype));
export {};
