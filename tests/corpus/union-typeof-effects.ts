type Value = { a: number } | { b: string } | number | null | undefined;
let calls = 0;
const sentinel = new Error("sentinel");
function read(index: number): Value {
  calls++;
  if (index === 0) return { a: 4 };
  if (index === 1) return { b: "text" };
  if (index === 2) return 8;
  if (index === 3) return null;
  if (index === 4) return undefined;
  throw sentinel;
}
for (const index of [0, 1, 2, 3, 4]) {
  const before = calls;
  console.log(index, typeof read(index) === "object", "object" !== typeof read(index), calls - before);
}
class Holder {
  get current(): Value { return read(1); }
}
const holder = new Holder();
function optional(present: boolean): Holder | undefined {
  calls++;
  return present ? holder : undefined;
}
let before = calls;
console.log("getter", typeof holder.current === "object", calls - before);
before = calls;
console.log("optional", typeof optional(false)?.current === "object", calls - before);
before = calls;
console.log("present", typeof optional(true)?.current !== "object", calls - before);
before = calls;
console.log("skip", false && typeof read(5) === "object", calls - before);
try { console.log(typeof read(5) === "object"); }
catch (error) { console.log("throw", error === sentinel); }
function object(index: number): { a: number } | { b: string } {
  calls++;
  if (index < 0) throw sentinel;
  return index === 0 ? { a: 7 } : { b: "owned" };
}
before = calls;
console.log("folded", typeof object(0) === "object", typeof object(1) !== "object", typeof object(0) === "string", calls - before);
try { console.log(typeof object(-1) === "string"); }
catch (error) { console.log("folded throw", error === sentinel); }
let objects = 0;
for (let index = 0; index < 40; index++) if (typeof read(index % 5) === "object") objects++;
console.log("owned", objects, "recovery", typeof read(2) !== "object");
