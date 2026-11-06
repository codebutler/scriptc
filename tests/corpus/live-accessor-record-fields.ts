let events = "";
function make(value: number) {
  const token = Object.freeze({ value });
  const state = { count: value };
  const literal = {
    nested: { token, state },
    get computed() { events += "get;"; return state.count; },
    set computed(next: number) { events += "set;"; state.count = next; },
    get failing(): number { events += "throw;"; throw new Error("accessor"); },
  };
  const boxed: object = literal;
  return { boxed, literal, token, state };
}
const first = make(3);
const second = make(7);
const nested = Reflect.get(first.boxed, "nested");
const token = Reflect.get(nested, "token");
const state = Reflect.get(nested, "state");
console.log(token === first.token, token === second.token, Object.isFrozen(token));
console.log(nested === Reflect.get(first.boxed, "nested"), events);
console.log(Reflect.get(first.boxed, "computed"), events);
Reflect.set(state, "count", 11);
console.log(first.state.count, first.literal.computed);
first.state.count = 13;
console.log(Reflect.get(state, "count"));
Reflect.set(first.boxed, "computed", 17);
console.log(first.state.count, Reflect.get(state, "count"), events);
const descriptor = Object.getOwnPropertyDescriptor(first.boxed, "computed");
if (!descriptor) throw new Error("missing descriptor");
console.log(typeof descriptor.get, typeof descriptor.set, descriptor.enumerable, descriptor.configurable);
console.log(descriptor.get?.call(second.literal), events);
try { Reflect.get(first.boxed, "failing"); } catch (error) {
  console.log(error instanceof Error ? error.message : "unknown", events);
}
console.log(Reflect.set(token, "value", 99), first.token.value);
