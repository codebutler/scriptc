// `Number` and `BigInt` chosen by a ternary and stored as one `(value: number | bigint) => number | bigint` converter: each arm converts any argument, and the stored constructor's own result comes back.
type Convert = (value: number | bigint) => number | bigint;
const seven: number = Date.now() > 0 ? 7 : 8;

function converterFor(bits: number): Convert {
  return bits == 32 ? Number : BigInt;
}
for (const bits of [32, 64]) {
  const toWord: Convert = bits == 32 ? Number : BigInt;
  console.log(bits, typeof toWord(seven), toWord(seven), toWord(BigInt(seven) * 3n));
  const fromFn = converterFor(bits);
  console.log(bits, typeof fromFn(seven), fromFn(BigInt(seven)));
}

// The same selection without the annotation on the ternary: its own type is the
// union of both constructors, adapted again where it lands.
const wide = seven > 100;
const picked = wide ? BigInt : Number;
const viaPicked: Convert = picked;
console.log(typeof viaPicked(seven), viaPicked(seven), viaPicked(5n));

// Reassignment instead of a ternary, and a ternary of one constructor.
let assigned: Convert;
if (wide) assigned = BigInt;
else assigned = Number;
console.log(typeof assigned(seven), assigned(9n));
const same: Convert = wide ? Number : Number;
console.log(typeof same(seven), same(seven));

// The constructors passed as arguments and kept in an array of converters.
function apply(f: Convert, value: number | bigint): number | bigint {
  return f(value);
}
console.log(apply(Number, 11n), apply(BigInt, seven), apply(Number, seven));
const converters: Convert[] = [Number, BigInt];
for (const c of converters) console.log(typeof c(seven), c(seven), c(2n));
