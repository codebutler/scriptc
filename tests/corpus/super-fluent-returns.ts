class NativeBase { nativeTouch(): this { console.log("native base"); return this; } }
class NativeWidget extends NativeBase {
 nativeTouch(): this { console.log("wrong virtual target"); return this; }
 child(): this { return super.nativeTouch(); }
}
class NativeDeeper extends NativeWidget { extra = 7; }
console.log("native", new NativeDeeper().child().extra);
class Base {
 value = "";
 append(value: string): this { this.value = value; return this; }
 format(value: string): string;
 format(value: number): number;
 format(value: string | number): string | number { return value; }
 pong(): void { console.log("pong"); }
}
let replaceDuringArgument = false;
function argument(): string {
 console.log("argument");
 if (replaceDuringArgument) Object.defineProperty(Base.prototype, "append", { configurable: true, value: () => { console.log("later replacement"); return new Deeper(); } });
 return "argument value";
}
function values(): [string] { console.log("values"); return ["spread"]; }
class Widget extends Base {
 append(value: string): this { console.log("wrong virtual append", value); return this; }
 child(value: string): this { return super.append(value); }
 literal(value: string): this { return super["append"](value); }
 lazy(): this { return super.append(argument()); }
 spread(): this { return super.append(...values()); }
 text(): string { return super.format("text").toUpperCase(); }
 number(): number { return super.format(3) + 1; }
 ping(): void { super.pong(); }
}
class Deeper extends Widget { extra = 42; }
class Deepest extends Deeper { last = 8; }
const original = Base.prototype.append;
const instance = new Deeper();
console.log("original", instance.child("first") === instance, instance.value, instance.extra);
console.log("literal", instance.literal("literal") === instance, instance.value);
console.log("overload", instance.text(), instance.number()); instance.ping();
Object.defineProperty(Base.prototype, "append", {
 configurable: true,
 value: function(this: Base, value: string): Deepest { console.log("replacement", this === instance, value); const separate = new Deepest(); separate.value = value; return separate; },
});
const separate = instance.child("separate");
console.log("separate", separate !== instance, separate.extra, separate.value);
Object.defineProperty(Base.prototype, "append", {
 configurable: true,
 get: function(this: Base) {
  console.log("getter", this === instance, this.value);
  this.value = "getter wrote";
  return function(this: Base, value: string): Deeper { console.log("callee", this === instance, this.value, value); return instance; };
 },
});
replaceDuringArgument = true;
console.log("lazy", instance.lazy() === instance);
replaceDuringArgument = false;
console.log("later", instance.child("after").extra);
const sentinel = new Error("original");
Object.defineProperty(Base.prototype, "append", { configurable: true, get: () => { console.log("throwing getter"); throw sentinel; } });
try { instance.lazy(); } catch(error) { console.log("getter identity", error === sentinel); }
Object.defineProperty(Base.prototype, "append", { configurable: true, get: () => 42 });
try { instance.lazy(); } catch(error) { console.log("noncallable", error instanceof TypeError); }
Object.defineProperty(Base.prototype, "append", { configurable: true, value: () => { throw sentinel; } });
try { instance.child("throw"); } catch(error) { console.log("call identity", error === sentinel); }
Object.defineProperty(Base.prototype, "append", { configurable: true, value: original });
console.log("restored", instance.spread() === instance, instance.value);
function through<T extends Widget>(value: T): T { return value.child("generic"); }
console.log("generic", through(new Deepest()).last);
class Root { own(): unknown { return this; } }
class Middle extends Root { own(value = 1): this { console.log("own argument", value); return this; } }
class Leaf extends Middle { extra = 9; child(): this { return super.own(17); } }
console.log("own result", new Leaf().child().extra);
export {};
