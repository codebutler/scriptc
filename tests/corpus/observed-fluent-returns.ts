class Base {
  value = "";
  append(value: string): this { this.value = value; return this; }
}
class Widget extends Base {
  child(value: string): this { return this.append(value); }
}
class Deeper extends Widget { extra = 42; }
class Deepest extends Deeper { last = 7; }
const original = Base.prototype.append;
const instance = new Deeper();
console.log("original", instance.child("first") === instance, instance.extra, instance.value);
Object.defineProperty(Base.prototype, "append", {
  configurable: true,
  value: function (this: Base, value: string): Deeper {
    console.log("replacement", this === instance, value);
    const separate = new Deeper(); separate.value = value; return separate;
  },
});
const separate = instance.child("second");
console.log("separate", separate !== instance, separate.extra, separate.value);
Object.defineProperty(Base.prototype, "append", {
  configurable: true,
  get: function (this: Base) {
    console.log("get", this === instance);
    return function (this: Base, value: string): Deepest {
      console.log("call", this === instance, value);
      const result = new Deepest(); result.value = value; return result;
    };
  },
});
function receiver(): Deeper { console.log("receiver"); return instance; }
function argument(): string { console.log("argument"); return "third"; }
console.log("getter result", receiver().append(argument()).extra);
const sentinel = new Error("original");
Object.defineProperty(Base.prototype, "append", {
  configurable: true, value: () => { throw sentinel; },
});
try { instance.child("throw"); } catch (error) { console.log("throw identity", error === sentinel); }
Object.defineProperty(Base.prototype, "append", { configurable: true, value: original });
console.log("restored", instance.child("last") === instance, instance.value);
class OwnBase { child(): unknown { return this; } }
class Own extends OwnBase { child(): this { return this.hop(); } hop(): this { return this; } }
class OwnDeeper extends Own { extra = 8; }
console.log(typeof Own.prototype.hop);
console.log("own", new OwnDeeper().child().extra);
function through<T extends Widget>(value: T): T { return value.child("generic"); }
console.log("generic", through(new Deepest()).last);
export {};
