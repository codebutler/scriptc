// Index-signature records read through a checked-dynamic view: a
// `Record<string, T>` held as `Record<string, unknown>` or `unknown`, and
// `Object.fromEntries` over unknown values held as `Record<string, unknown>`.
// Reads, `in` and hasOwn of keys the record holds answer from the record,
// converting only the value read; absent and inherited keys answer as the
// object would. Writes on either side show through the other, before and
// after the view has been walked or written. The large loops at the end
// used to be quadratic: each read rebuilt the whole view.

const numbers: Record<string, number> = { b: 2, a: 1, "10": 10, "2": 20 };
const view: Record<string, unknown> = numbers;
console.log(view["a"], view["b"], view["10"], view["2"], view["missing"]);
console.log(Object.keys(view).join(","));
console.log("a" in view, "missing" in view, "toString" in view);
console.log(Object.hasOwn(view, "a"), Object.hasOwn(view, "toString"), Object.hasOwn(view, "zz"));
console.log(typeof view["toString"], typeof view["hasOwnProperty"]);

// Static writes after boxing show through the view.
numbers["c"] = 3;
numbers["a"] = 100;
console.log(view["c"], view["a"], Object.keys(view).join(","));

// Writes through the view reach the record, and later reads of the view.
view["d"] = 4;
view["b"] = 200;
console.log(numbers["d"], numbers["b"], view["d"], view["b"]);

// The view has been walked and written; static writes still show.
numbers["e"] = 5;
numbers["c"] = 30;
console.log(view["e"], view["c"], "e" in view, JSON.stringify(view));

// A miss, then hits of keys added afterwards.
console.log(view["late"]);
numbers["late"] = 6;
console.log(view["late"], "late" in view);

// Strings and booleans, through `unknown`.
const words: Record<string, string> = { hello: "world", empty: "" };
const wordsSeen: unknown = words;
const wordsView = wordsSeen as Record<string, unknown>;
console.log(wordsView["hello"], JSON.stringify(wordsView["empty"]), wordsView["nope"]);
const flags: Record<string, boolean> = { on: true, off: false };
const flagsView: Record<string, unknown> = flags;
console.log(flagsView["on"], flagsView["off"], flagsView["neither"], "off" in flagsView);
flags["off"] = true;
console.log(flagsView["off"]);

// Record values convert one at a time.
interface Row {
  name: string;
  size: number;
}
const rows: Record<string, Row> = { x: { name: "ex", size: 1 } };
const rowsView: Record<string, unknown> = rows;
const row = rowsView["x"] as Row;
console.log(row.name, row.size, rowsView["y"]);
rows["y"] = { name: "why", size: 2 };
console.log((rowsView["y"] as Row).name, Object.keys(rowsView).join(","));

// Object.fromEntries over unknown values.
const inc = (x: number): number => x + 1;
const nested = { k: 1 };
const entries: [string, unknown][] = [
  ["inc", inc],
  ["n", 7],
  ["s", "text"],
  ["o", nested],
  ["n", 8],
];
const built: Record<string, unknown> = Object.fromEntries(entries);
const call = built["inc"] as (x: number) => number;
console.log(typeof built["inc"], call(41), built["n"], built["s"], (built["o"] as { k: number }).k);
console.log(built["o"] === built["o"], Object.keys(built).join(","), built["absent"]);
console.log("inc" in built, "absent" in built, Object.hasOwn(built, "s"), typeof built["valueOf"]);
built["n"] = 9;
built["added"] = true;
console.log(built["n"], built["added"], Object.keys(built).join(","), JSON.stringify(built));

// A record many times larger than the reads of it: each read used to copy
// every key.
const size = 20000;
const pairs: [string, unknown][] = [];
for (let i = 0; i < size; i++) pairs.push([`k${i}`, i]);
const big: Record<string, unknown> = Object.fromEntries(pairs);
let sum = 0;
for (let i = 0; i < size; i++) sum += big[`k${i}`] as number;
console.log(sum, big["k-1"], big[`k${size - 1}`]);

const counts: Record<string, number> = {};
for (let i = 0; i < size; i++) counts[`c${i}`] = i % 7;
const countsView: Record<string, unknown> = counts;
let present = 0;
let total = 0;
for (let i = 0; i < size; i++) {
  const key = `c${(i * 13) % (size + 3)}`;
  if (key in countsView) present++;
  const value = countsView[key];
  if (typeof value === "number") total += value;
}
console.log(present, total);
