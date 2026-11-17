class Base { value = 10; read(n: number): number { return this.value + n; } }
class Child extends Base { extra = 7; }
const first = new Child();
const second = new Child(); second.value = 20;
let current = first;
function receiver(): Child { console.log("receiver"); return current; }
function argument(): number { console.log("argument"); return 3; }
Object.defineProperty(Base.prototype, "read", {
 configurable: true,
 get: function(this: Base) {
  console.log("getter", this === first, this.value);
  this.value += 1;
  current = second;
  return function(this: Base, n: number): number {
   console.log("call", this === first, this.value); return this.value + n;
  };
 },
});
console.log("direct", receiver().read(argument()));
current = first;
const saved = receiver().read;
console.log("extracted", saved.call(second, 4), first.value);
Object.defineProperty(first, "read", {
 configurable: true,
 get: function(this: Base) {
  console.log("own getter", this === first, this.value);
  return function(this: Base, n: number): number { return this.value - n; };
 },
});
console.log("own", first.read(2));
const sentinel = new Error("getter");
Object.defineProperty(first, "read", { configurable: true, get: () => { throw sentinel; } });
current = first;
try { receiver().read(argument()); } catch(error) { console.log("getter throw", error === sentinel); }
Object.defineProperty(first, "read", { configurable: true, get: () => 42 });
try { receiver().read(argument()); } catch(error) { console.log("not callable", error instanceof TypeError); }
export {};
