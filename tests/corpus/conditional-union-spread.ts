type Axis =
  | { mode: "fixed"; size: number; min?: number; max?: number }
  | { mode: "hug"; min?: number; max?: number }
  | { mode: "fill"; share: number; min?: number; max?: number };

function bounded(value: Axis, min?: number, max?: number): Axis {
  return { ...value, ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
}
const fixed: Axis = { mode: "fixed", size: 10, min: 3 };
const changed = bounded(fixed, 0, 20);
console.log("fixed", JSON.stringify(changed), JSON.stringify(fixed), changed !== fixed);
console.log("hug", JSON.stringify(bounded({ mode: "hug" })));
console.log("fill", JSON.stringify(bounded({ mode: "fill", share: 2 }, undefined, 50)));

const events: string[] = [];
function condition(value: boolean): boolean { events.push("condition"); return value; }
function field(): number { events.push("field"); return 7; }
function source(): Axis { events.push("source"); return { mode: "fixed", size: 1 }; }
function ordered(flag: boolean): Axis {
  return { ...source(), ...(condition(flag) ? { min: field() } : {}), max: field() };
}
console.log("taken", JSON.stringify(ordered(true)), events.join(","));
events.length = 0;
console.log("absent", JSON.stringify(ordered(false)), events.join(","));
events.length = 0;
function andSpread(value: Axis, flag: boolean): Axis { return { ...value, ...(flag && { min: field() }) }; }
console.log("and", JSON.stringify(andSpread({ mode: "hug" }, false)), JSON.stringify(andSpread({ mode: "hug" }, true)), events.join(","));

const thrown = { message: "same" };
function fail(): number { events.push("throw"); throw thrown; }
function throwing(value: Axis): Axis { return { ...value, ...(condition(true) ? { min: fail() } : {}), max: field() }; }
events.length = 0;
try { throwing({ mode: "hug" }); } catch (error) { console.log("throw", error === thrown, events.join(",")); }
console.log("recovery", JSON.stringify(bounded({ mode: "hug" }, 2)));
interface Box { value: number; }
type WithBox = { kind: "left"; left: number; box: Box } | { kind: "right"; right: number; box: Box };
const originalBox: Box = { value: 1 }, replacementBox: Box = { value: 2 };
function selectBox(): Box { events.push("box"); return replacementBox; }
function replaceBox(value: WithBox, flag: boolean): WithBox { return { ...value, ...(flag ? { box: selectBox() } : {}) }; }
events.length = 0;
const boxSource: WithBox = { kind: "left", left: 3, box: originalBox };
const boxCopy = replaceBox(boxSource, true);
replacementBox.value = 8;
console.log("reference", boxCopy !== boxSource, boxCopy.box === replacementBox, boxCopy.box.value, boxSource.box.value, events.join(","));
export {};
