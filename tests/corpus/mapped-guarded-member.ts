interface State { layout: { x: number }; semantics: { selected: boolean }; }
type Change<A extends keyof State> = Partial<State[A]>;
const events: string[] = [];
function mapped<A extends keyof State>(changes: Change<A>): unknown {
  if ("selected" in changes) return changes.selected;
  return "absent";
}
function readonlyMapped<A extends keyof State>(changes: Readonly<Change<A>>): unknown {
  if ("selected" in changes) return changes.selected;
  return "absent";
}
function raw<T extends object>(changes: T): unknown {
  if ("selected" in changes) return changes.selected;
  return "absent";
}
console.log("absent", mapped<"layout">({x: 1}), readonlyMapped<"layout">({x: 2}));
console.log("present", mapped<"semantics">({selected: true}), readonlyMapped<"semantics">({selected: false}));
const hidden: Change<"layout"> = JSON.parse('{"x":3,"selected":"kept"}');
console.log("hidden", raw(hidden), mapped<"layout">(hidden), readonlyMapped<"layout">(hidden));
const getter: unknown = {x: 4, get selected() {events.push("getter");return 42;}};
const checked = getter as Change<"layout">;
console.log("before getter", events.length);
console.log("getter", raw(checked), mapped<"layout">(checked), readonlyMapped<"layout">(checked), events.join(","));
const sentinel = {message:"same"};
const throwing: unknown = {x: 5, get selected() {events.push("throw");throw sentinel;}};
try {mapped<"layout">(throwing as Change<"layout">);} catch (error) {console.log("throw",error === sentinel);}
console.log("recovery",mapped<"layout">({x: 6}));
function byArea<A extends keyof State>(area: A, changes: Change<A>): void {
  if (area === "semantics" && "selected" in changes) console.log("area", changes.selected);
}
byArea("layout", checked);
byArea("semantics", {selected:true});
console.log("getter count",events.filter(value => value === "getter").length);
export {};
