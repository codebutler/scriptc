// Reflect deletes representable optional record slots in place, including
// through a finite runtime key. Its false result is independent of lexical
// strictness; ordinary strict `delete` keeps its throwing behavior.
type State = {
  scalar?: number;
  object?: { id: number };
  action?: () => number;
};
type Key = "scalar" | "object" | "action";

function remove(target: State, key: Key): boolean {
  return Reflect.deleteProperty(target, key);
}

function show(label: string, target: State): void {
  console.log(
    label,
    Object.keys(target).join(","),
    "scalar" in target,
    Object.hasOwn(target, "scalar"),
    "object" in target,
    "action" in target,
    JSON.stringify(target),
  );
}

// Keep the retained-state merge pattern: undefined means absence, while
// every other value is written back through the same generic key.
function merge<T extends object>(target: T, changes: Partial<T>): void {
  for (const [key, value] of Object.entries(changes) as Array<[keyof T, T[keyof T] | undefined]>) {
    if (value === undefined) {
      if (!Reflect.deleteProperty(target, key))
        throw new TypeError(`Cannot remove retained state property ${String(key)}`);
    } else target[key] = value;
  }
}

const object = { id: 42 };
const action = (): number => 7;
const state: State = { scalar: 1, object, action };
const alias = state;
show("initial", state);
console.log("scalar deleted", remove(alias, "scalar"));
show("scalar absent", state);
console.log("scalar deleted twice", remove(state, "scalar"));
state.scalar = undefined;
show("scalar present undefined", state);
console.log("present undefined deleted", remove(state, "scalar"));
show("undefined now absent", state);
state.scalar = 2;
show("scalar reinserted", state);
console.log("kept references", state.object === object, state.action === action, state.action?.());
console.log("object deleted", remove(state, "object"));
console.log("action deleted", remove(alias, "action"));
show("only scalar", state);
merge(state, { scalar: undefined });
show("merge cleared", alias);
merge(state, { scalar: 3, object, action });
show("merge inserted", state);
console.log("merge references", state.object === object, state.action === action, state.action?.());
merge(alias, { scalar: undefined, object: undefined, action: undefined });
show("merge removed all", state);

// A compatible width view still refers to the original object.
const wider: State = { scalar: 9, object };
const narrower: { scalar?: number } = wider;
console.log("width delete", Reflect.deleteProperty(narrower, "scalar"), "scalar" in wider);
console.log("width preserves other", wider.object === object, Object.keys(wider).join(","));

const frozen: State = { scalar: undefined, object };
Object.freeze(frozen);
console.log("frozen present", remove(frozen, "scalar"), remove(frozen, "object"));
console.log("frozen absent", remove(frozen, "action"));
show("frozen unchanged", frozen);
try {
  delete frozen.scalar;
  console.log("strict frozen delete did not throw");
} catch (error) {
  console.log("strict frozen delete", error instanceof TypeError);
}
try {
  merge(frozen, { scalar: undefined });
  console.log("frozen merge did not throw");
} catch (error) {
  console.log("frozen merge", error instanceof TypeError);
}

// Both argument expressions run once, in order. A key expression that
// replaces the target's binding must not redirect the deletion.
const events: string[] = [];
let current: State = { scalar: 11 };
function target(): State {
  events.push("target");
  return current;
}
function key(): "scalar" {
  events.push("key");
  return "scalar";
}
console.log("ordered delete", Reflect.deleteProperty(target(), key()), events.join(","));
show("ordered result", current);
events.length = 0;
current = { scalar: 12 };
const held = current;
function replacingKey(): "scalar" {
  events.push("replace");
  current = { scalar: 22 };
  return "scalar";
}
console.log("held delete", Reflect.deleteProperty(target(), replacingKey()), events.join(","));
console.log("held identity", held !== current, "scalar" in held, current.scalar);
events.length = 0;
const thrownKey = { id: "key failure" };
function throwingKey(): "scalar" {
  events.push("throw");
  throw thrownKey;
}
try {
  Reflect.deleteProperty(target(), throwingKey());
  console.log("throwing key did not throw");
} catch (error) {
  console.log("throwing key identity", error === thrownKey, events.join(","));
}
show("throwing key left target", current);

// A generic keyof call may pass a primitive through a dynamic slot. Keep
// the Symbol case dynamic without asserting that it is a string.
function removeRawKey(target: State, key: any): boolean {
  return Reflect.deleteProperty(target, key);
}

const numeric: { "1"?: number; scalar?: number } = { "1": 10, scalar: 20 };
console.log("numeric key", Reflect.deleteProperty(numeric, 1), Object.keys(numeric).join(","));
const stringKey: string = "scalar";
console.log("string key", Reflect.deleteProperty(numeric, stringKey), Object.keys(numeric).join(","));
const symbolTarget: State = { scalar: 30 };
console.log("raw symbol absent", removeRawKey(symbolTarget, Symbol("absent")), symbolTarget.scalar);


export {};
