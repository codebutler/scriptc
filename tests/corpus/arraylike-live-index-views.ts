function itemAt<T>(values: ArrayLike<T>, index: number): T | undefined {
  return values[index];
}
function size<T>(values: ArrayLike<T>): number { return values.length; }
function same<T>(values: ArrayLike<T>): ArrayLike<T> { return values; }

const first = { label: "first" };
const second = { label: "second" };
const objects = [first];
const view: ArrayLike<{ label: string }> = same(objects);
console.log("identity", view === objects, itemAt(view, 0) === first);
objects[0] = second;
console.log("live", itemAt(view, 0) === second);
console.log("missing", itemAt(view, -1), itemAt(view, 4), itemAt(view, 0.5));
const sparse: (number | undefined)[] = [1, , undefined, 4];
console.log("sparse", itemAt(sparse, 0), itemAt(sparse, 1), itemAt(sparse, 2), size(sparse));
console.log("readonly", itemAt(["a", "b"] as readonly string[], 1));
const bytes = new Uint8Array([2, 7]);
const byteView: ArrayLike<number> = same(bytes);
bytes[1] = 9;
console.log("bytes", byteView === bytes, itemAt(byteView, 1), itemAt(byteView, 9));
console.log("string", itemAt("abc", 1), itemAt("abc", -1), size("abc"));

let reads = 0;
let lengths = 0;
const sentinel = new Error("index");
const getter = {
  get length() { lengths++; return 2; },
  get 0() { reads++; return second; },
  get 1(): { label: string } { throw sentinel; },
};
const getterView = same(getter);
console.log("lazy", reads, lengths, getterView === getter);
console.log("get", itemAt(getterView, 0) === second, reads, lengths);
console.log("length", size(getterView), lengths);
try { itemAt(getterView, 1); } catch (error) { console.log("throw", error === sentinel); }
console.log("recover", itemAt(getterView, 0) === second, reads, lengths);

function receiver(): ArrayLike<{ label: string }> { console.log("receiver"); return getter; }
function index(): number { console.log("index"); return 0; }
console.log("order", itemAt(receiver(), index()) === second);
const fn = (n: number) => n + 4;
const functions = { 0: fn, length: 1 };
console.log("function", itemAt(functions, 0) === fn, itemAt(functions, 0)?.(3));

function namedIndex(values: ArrayLike<string>): void {
  console.log("named", values["0"], values["9"], values["length"]);
}
namedIndex("abc");
class Indexed {
  readonly [index: number]: { label: string };
  readonly length = 1;
  get 0() { return second; }
}
const instance = new Indexed();
console.log("class", same(instance) === instance, itemAt(instance, 0) === second);
