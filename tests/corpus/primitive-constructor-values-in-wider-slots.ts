// `String`, `Number` and `Boolean` as values in function slots whose parameter is not a string: called with numbers, bigints and unknowns, directly and through stored constructor values, while string slots and other functions of the constructor's signature keep their behavior.
const seven: number = Date.now() > 0 ? 7 : 8;
const never = seven > 100;

function viaNumber(f: (v: number) => string): string {
  return f(seven);
}
function viaFlag(f: (v: number) => boolean): boolean {
  return f(0);
}
function viaUnknown(f: (v: unknown) => number): number {
  return f(BigInt(seven));
}
function viaVoid(f: (v: number) => void): void {
  f(seven);
}
console.log(JSON.stringify(viaNumber(String)), viaFlag(Boolean), viaUnknown(Number));
viaVoid(String);

// A generic parameter instantiated by the argument.
function apply<T, R>(f: (v: T) => R, v: T): R {
  return f(v);
}
console.log(apply(Number, "12"), JSON.stringify(apply(String, seven)), apply(Boolean, seven));

// Stored constructor values: a reassigned variable and a function result.
let toNum = Number;
if (never) toNum = Number;
function stringer(): StringConstructor {
  return String;
}
console.log(viaUnknown(toNum), JSON.stringify(viaNumber(stringer())));

// Method slots compare parameters bivariantly, so a stored `(s: string) =>
// number` may be the constructor or any other function of that signature.
interface Measure {
  m(v: string | number): number;
}
let parse: (s: string) => number = Number;
if (never) parse = (s) => s.length;
let count: (s: string) => number = (s) => s.length;
if (never) count = Number;
const parsing: Measure = { m: parse };
const counting: Measure = { m: count };
console.log(parsing.m(seven), parsing.m("0x10"), counting.m("abcd"));

// A string slot keeps the string-input form: identity and coercion as before.
const str: (s: string) => number = Number;
console.log(apply(str, " 5 "), str === Number);
