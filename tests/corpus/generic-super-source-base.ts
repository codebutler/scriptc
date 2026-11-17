const events: string[] = [];
class Base {
  total = 0;
  scroll(value: number): this {
    events.push("base:" + value);
    this.total += value;
    return this;
  }
}
class Child<T> extends Base {
  readonly item: T;
  constructor(item: T) { super(); this.item = item; }
  override scroll(value: number): this {
    events.push("child");
    return super.scroll(value);
  }
  literal(value: number): this { return super["scroll"](value); }
  argument(): this {
    return super.scroll((events.push("arg"), 4));
  }
}
class Deeper extends Child<string> {
  extra = 42;
  constructor() { super("deep"); }
}
const saved = Base.prototype.scroll;
const first = new Child("first");
const second = new Child(7);
const deep = new Deeper();
console.log("original", first.scroll(2) === first, second.scroll(3).item, deep.scroll(1).extra);
console.log("totals", first.total, second.total, deep.total, events.join(","));
events.length = 0;
Object.defineProperty(Base.prototype, "scroll", {
  configurable: true,
  value: function(this: Base, value: number) {
    events.push("replacement:" + value);
    this.total += value * 2;
    return this;
  },
});
console.log("replace", first.scroll(5) === first, deep.literal(2) === deep, first.total, deep.total, events.join(","));
events.length = 0;
Object.defineProperty(Base.prototype, "scroll", {
  configurable: true,
  get: function(this: Base) {
    events.push(this === deep ? "getter:deep" : "getter:other");
    return function(this: Base, value: number) {
      events.push(this === deep ? "call:deep" : "call:other");
      this.total += value;
      return this;
    };
  },
});
console.log("getter", deep.argument() === deep, deep.total, events.join(","));
const sentinel = { code: "same" };
let identity = false;
Object.defineProperty(Base.prototype, "scroll", {
  configurable: true,
  value: function() { throw sentinel; },
});
try { first.scroll(1); } catch (error) { identity = error === sentinel; }
console.log("throw", identity);
Object.defineProperty(Base.prototype, "scroll", { configurable: true, writable: true, value: saved });
console.log("restore", second.scroll(2) === second, second.total, deep.scroll(1).item);
export {};
