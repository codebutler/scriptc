interface First { value: { n: number }; a?: number }
interface Second { value: { n: number }; b?: number }
interface Third { value: { n: number }; c?: number }
function asFirst(v: Second): First { return v; }
function asSecond(v: Third): Second { return v; }
function asThird(v: First): Third { return v; }
function inspect(v: First, original: { n: number }) {
  const entries = Object.entries(v);
  console.log(entries.map(([key]) => key).join(","), entries[0]![1] === original,
    Object.values(v)[0] === original);
}
const identity = { n: 5 };
const wide = { value: identity, extra: 7, a: 1, b: undefined, c: 4 };
const first: First = wide;
inspect(first, identity);
inspect(asFirst(asSecond(asThird(first))), identity);
inspect(asFirst(asSecond(asThird(asFirst(asSecond(asThird(first)))))), identity);
const reversed = { c: 4, value: identity, a: 2 };
inspect(asFirst(asSecond(reversed)), identity);
function firstThroughThird(v: Third): First { return v; }
function thirdThroughSecond(v: Second): Third { return v; }
function secondThroughFirst(v: First): Second { return v; }
const fromSecond = secondThroughFirst(first);
inspect(firstThroughThird(thirdThroughSecond(fromSecond)), identity);
inspect(asFirst(secondThroughFirst(firstThroughThird(thirdThroughSecond(fromSecond)))), identity);
export {};
