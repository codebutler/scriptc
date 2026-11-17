type Action = () => void | Promise<void>;
interface Item { action?: Action; run?: Action; }
let calls = 0;
const events: string[] = [];
function finish(run: () => unknown): unknown {
  events.push("finish");
  return run();
}
function menu(item: Item): (() => unknown) | null {
  const run = item.action ?? item.run;
  return run ? () => finish(run) : null;
}
const first: Action = () => { calls++; events.push("first"); };
const second: Action = () => { calls++; events.push("second"); };
const item: Item = { action: first };
const selected = menu(item);
item.action = second;
console.log("snapshot", selected?.() === undefined, calls, events.join(","));
console.log("missing", menu({}) === null, calls);
const promise = Promise.resolve();
const asyncSelected = menu({ run: () => { calls++; return promise; } });
console.log("promise", asyncSelected?.() === promise, calls);
const sentinel = { value: "same" };
const throwing = menu({ action: () => { calls++; throw sentinel; } });
try { throwing?.(); } catch (error) { console.log("throw", error === sentinel, calls); }
console.log("recover", selected?.() === undefined, calls);
function identity(input: Action | undefined) {
  const run = input;
  return run ? () => run : null;
}
console.log("identity", identity(first)?.() === first, identity(undefined) === null);
function nested(input: (() => number) | undefined) {
  const run = input;
  return run ? () => () => finish(run) : null;
}
const delayed = nested(() => 42);
console.log("nested", delayed?.()(), nested(undefined) === null);
let reads = 0;
const getterItem: Item = { get action() { reads++; return first; } };
const getterSelected = menu(getterItem);
console.log("getter-before", reads);
console.log("getter-after", getterSelected?.() === undefined, reads, calls);
function nullChoice(input: (() => string) | null) {
  const run = input;
  return run !== null ? () => finish(run) : null;
}
console.log("null", nullChoice(null) === null, nullChoice(() => "ok")?.());
export {};
