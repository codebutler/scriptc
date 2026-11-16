type Values = number[] | Float32Array | Uint16Array;
function summary(values: Values) {
  let visits = 0;
  const all = values.every((n, i, original) => {
    if (original !== values) throw new Error("receiver identity");
    visits++;
    return Number.isFinite(n) && i >= 0;
  });
  let someVisits = 0;
  const some = values.some((n, i, original) => {
    if (original !== values) throw new Error("receiver identity");
    someVisits++;
    return n > 1 ? "yes" : "";
  });
  console.log("summary", all, visits, some, someVisits);
}
summary([]);
summary(new Float32Array());
summary([0, 2, 3]);
summary(new Float32Array([0, 2, NaN]));
summary(new Uint16Array([0, 2, 3]));
summary(new Float32Array([-0, Infinity]));
const sparse: number[] = [];
sparse[2] = 3;
summary(sparse);
function mutate(values: Values) {
  let seen = "";
  const result = values.every((n, i, original) => {
    seen += `${i}:${n};`;
    if (i === 0) {
      original[1] = 9;
      if (Array.isArray(original)) original.push(99);
    }
    return n < 10;
  });
  console.log("mutate", result, seen, values.length, values[1]);
}
mutate([1, 2, 3]);
mutate(new Float32Array([1, 2, 3]));
mutate(new Uint16Array([1, 2, 3]));
let reads = 0;
let order = "";
class Holder {
  value: Values = new Float32Array([1, 2]);
  get values(): Values { reads++; order += "receiver;"; return this.value; }
}
const holder = new Holder();
function predicate() {
  order += "argument;";
  holder.value = [99];
  return (n: number) => { order += `call:${n};`; return n < 3; };
}
console.log("order", holder.values.every(predicate()), reads, order);
const sentinel = new Error("sentinel");
function throwing(values: Values) {
  try { values.some(() => { throw sentinel; return false; }); }
  catch (error) { console.log("throw", error === sentinel); }
  console.log("recovery", values.every(Number.isFinite));
}
throwing([1]);
throwing(new Float32Array([1]));
function nested(values: Values) {
  return values.every(n => new Uint16Array([n]).every(m => m === n));
}
for (let i = 0; i < 40; i++) {
  if (!nested(i % 2 ? [1, 2] : new Float32Array([1, 2]))) throw sentinel;
}
console.log("nested", true);
