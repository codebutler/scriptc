class FakeMethods { tag = 1; }
// Each declaration owns its private method, including incompatible signatures.
class BaseMethods {
  #value = 4;
  #offset(axis: string, side: string, n: number): string {
    return axis + side + (n + this.#value);
  }
  base() { return this.#offset("x", "left", 2); }
  extractBase() { return this.#offset; }
  static has(value: BaseMethods | FakeMethods) { return #offset in value; }
  static checkedBase(value: unknown) { return (value as BaseMethods).#offset("y", "top", 1); }
}
class OwnMethods extends BaseMethods {
  value = 10;
  #offset(index: number): number { return index + this.value; }
  own() { return this.#offset(3); }
  extractOwn() { return this.#offset; }
  static hasOwn(value: OwnMethods | FakeMethods) { return #offset in value; }
  static checkedOwn(value: unknown) { return (value as OwnMethods).#offset(2); }
}
class LeafMethods extends OwnMethods {
  #offset(text: string): string { return "leaf:" + text; }
  leaf() { return this.#offset("ready"); }
}
const value = new LeafMethods();
console.log("direct", value.base(), value.own(), value.leaf());
console.log("checked", BaseMethods.checkedBase(value), OwnMethods.checkedOwn(value));
const own = value.extractOwn();
const base = value.extractBase();
console.log("metadata", own.name, own.length, base.name, base.length);
console.log("identity", own === value.extractOwn(), own === new OwnMethods().extractOwn());
console.log("call", own.call(value, 5), base.call(value, "z", "right", 3));
const bound = own.bind(value);
console.log("bound", bound.name, bound.length, bound(6));
try { own(1); } catch (error) { console.log("unbound", error instanceof TypeError); }
let fakeCalls = 0;
const fake = { "#offset": (n: number) => { fakeCalls++; return n; } };
for (const raw of [new BaseMethods(), fake, null]) {
  try { OwnMethods.checkedOwn(raw); } catch (error) { console.log("brand", error instanceof TypeError); }
}
console.log("fake-calls", fakeCalls);
console.log("presence", BaseMethods.has(value), OwnMethods.hasOwn(value), OwnMethods.hasOwn(new FakeMethods()), BaseMethods.has(new FakeMethods()));
class GenericMethods<T> extends BaseMethods {
  #items: T[];
  constructor(items: T[]) { super(); this.#items = items; }
  #offset(index: number): number { return index + this.#items.length; }
  at(index: number): number { return this.#offset(index); }
}
const numbers = new GenericMethods([1, 2]);
const strings = new GenericMethods(["a"]);
console.log("generic", numbers.base(), numbers.at(4), strings.base(), strings.at(4));
class FluentBase {
  position = 0;
  #offset(axis: string, n: number): this { this.position = axis.length + n; return this; }
  place(): this { return this.#offset("x", 7); }
}
class FluentList<T> extends FluentBase {
  #items: T[];
  constructor(items: T[]) { super(); this.#items = items; }
  #offset(index: number): number { return index + this.#items.length; }
  at(index: number) { return this.#offset(index); }
}
const fluent = new FluentList(["a", "b"]);
console.log("fluent", fluent.place() === fluent, fluent.position, fluent.at(3));
class InitBase {
  #make(): string { return "base-init"; }
  baseValue = this.#make();
}
class InitOwn extends InitBase {
  #make(): string { return "own-init"; }
  ownValue = this.#make();
}
const initialized = new InitOwn();
console.log("initialized", initialized.baseValue, initialized.ownValue);
const detached = new OwnMethods();
Object.setPrototypeOf(detached, { "#offset": () => { fakeCalls++; return -1; } });
console.log("prototype", BaseMethods.checkedBase(detached), OwnMethods.checkedOwn(detached), fakeCalls);
class OnceBase {
  #call(): number { return 1; }
  base() { return this.#call(); }
}
class OnceOwn extends OnceBase {
  #call(n: number): number { if (n < 0) throw sentinel; return n + 2; }
  static invoke(receiver: () => OnceOwn, argument: () => number) { return receiver().#call(argument()); }
  static value(receiver: () => OnceOwn) { return receiver().#call; }
}
const sentinel = { message: "same" };
const once = new OnceOwn();
const order: string[] = [];
function receiver() { order.push("receiver"); return once; }
function argument() { order.push("argument"); return 4; }
console.log("once", OnceOwn.invoke(receiver, argument), order.join(","));
order.length = 0;
const saved = OnceOwn.value(receiver);
console.log("value-once", order.join(","), saved.call(once, 3));
try { saved.call(once, -1); } catch (error) { console.log("throw", error === sentinel); }
console.log("recovery", saved.call(once, 5));
class GenericMiddle<T> extends BaseMethods {
  marker: T;
  constructor(marker: T) { super(); this.marker = marker; }
}
class ConcreteChild extends GenericMiddle<number> {
  constructor() { super(12); }
  #offset(n: number): number { return n + this.marker; }
  child() { return this.#offset(3); }
  extract() { return this.#offset; }
}
const concrete = new ConcreteChild();
const concreteMethod = concrete.extract();
console.log("generic-middle", concrete.base(), concrete.child(), concreteMethod.call(concrete, 4), concreteMethod === new ConcreteChild().extract());
// Keep the private routes correct when unrelated writes make public methods observed.
function observe<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  target[key] = value;
}
export {};
