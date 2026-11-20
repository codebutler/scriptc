class Watch {
  #listeners: Set<() => void> | null = null;
  add(f: () => void) {
    (this.#listeners ??= new Set()).add(f);
  }
  reset() {
    this.#listeners = null;
  }
  remove(f: () => void) {
    this.#listeners?.delete(f);
  }
  send() {
    for (const cb of this.#listeners ?? []) cb();
  }
}
const w = new Watch();
w.add(() => console.log("a"));
w.add(() => console.log("b"));
w.send();

const third = () => console.log("c");
w.reset();
w.add(third);
w.send();
w.remove(third);
w.send();
interface Holder {
  items: Map<string, number> | undefined;
}
const holder: Holder = { items: undefined };
const effects: string[] = [];
function owner(): Holder {
  effects.push("owner");
  return holder;
}
function make(): Map<string, number> {
  effects.push("make");
  return new Map<string, number>();
}
console.log((owner().items ??= make()).set("a", 3) === holder.items);
console.log((owner().items ??= make()).get("a"), effects.join(","));

function elapsed(clock: () => number, state: { since: number | null }): number {
  return clock() - (state.since ??= clock());
}
let counter = 0;
const times: { since: number | null } = { since: null };
console.log(
  elapsed(() => ++counter, times),
  elapsed(() => ++counter, times),
  times.since,
  counter,
);
let setterCalls = 0;
let original: Set<number> | null = null;
class Sink {
  get value(): Set<number> | null {
    return null;
  }
  set value(v: Set<number> | null) {
    setterCalls++;
    original = v;
  }
}
const sink = new Sink();
const assigned = (sink.value ??= new Set<number>()).add(9);
console.log(assigned === original, assigned.has(9), setterCalls);
function maybe(x: number): Set<number> | null {
  return x > 0 ? new Set<number>() : null;
}
let dest: Set<number> | null = null;
console.log((dest ??= maybe(-1)) === null);
