// @transform-types
class Scope {
  saved: { changed: () => number; value: number };
  read: () => { value: number };
  constructor(public changed: () => number, public value: number = 4) {
    this.changed = () => 90;
    this.value = 99;
    this.saved = { changed, value };
    this.read = () => ({ value });
    value += 3;
    const nested = () => {
      const value = 12;
      return { value };
    };
    console.log("shadow", nested().value);
  }
}
const a = new Scope(() => 3);
const b = new Scope(() => 8, 20);
console.log("saved", a.saved.changed(), a.saved.value, b.saved.changed(), b.saved.value);
console.log("capture", a.read().value, b.read().value);
console.log("fields", a.changed(), a.value, b.changed(), b.value);
class Base { constructor(public base: number) {} }
class Derived extends Base {
  stored: { value: string };
  constructor(private value: string = "default") {
    super(5);
    this.stored = { value };
    this.value = "field";
  }
  field() { return this.value; }
}
const derived = new Derived();
console.log("derived", derived.base, derived.stored.value, derived.field());
