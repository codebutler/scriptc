interface Stroke { kind: "up" | "down"; key: string; code: string; repeat?: boolean; }
interface Payload { count: number; }
interface Full extends Stroke {
  repeat: boolean; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean;
  composing: boolean; inText: boolean; inLocalControl: boolean; keyCode: number; location: number;
  payload: Payload; callback: () => number;
}
interface Other extends Stroke { repeat: boolean; label: string; payload: Payload; callback: () => number; }
interface Held<F, S extends Stroke> { note(sample: S, from: F): void; release(): { sample: S; from: F }[]; }
function createHeld<F, S extends Stroke>(): Held<F, S> {
  const held = new Map<string, { sample: S; from: F }>();
  return {
    note(sample, from) {
      const id = sample.code || sample.key;
      if (sample.kind === "up") held.delete(id);
      else if (!held.has(id)) held.set(id, { sample, from });
    },
    release() {
      const out = [...held.values()].map(({ sample, from }) => ({
        sample: { ...sample, kind: "up" as const, repeat: false }, from,
      }));
      held.clear(); return out;
    },
  };
}
function direct<S extends Stroke>(sample: S) { return { ...sample, kind: "up" as const, repeat: false }; }
function named<F, S extends Stroke>(entries: { sample: S; from: F }[]) {
  const release = ({ sample, from }: { sample: S; from: F }) => ({ sample: { ...sample, kind: "up" as const, repeat: false }, from });
  return entries.map(release);
}
const callback = () => 7;
const full: Full = { kind: "down", key: "A", code: "KeyA", repeat: true, ctrl: true, alt: false, shift: true, meta: false, composing: false, inText: true, inLocalControl: false, keyCode: 65, location: 1, payload: { count: 3 }, callback };
const other: Other = { label: "other", repeat: true, kind: "down", code: "KeyB", key: "B", callback, payload: { count: 4 } };
function inspectFull(held: Held<number, Full>): void {
  held.note(full, 9); held.note(full, 10);
  const result = held.release(), first = result[0]; if (!first) throw new Error("missing full release");
  const sample = first.sample;
  console.log("full", first.from, sample.kind, sample.repeat, sample.ctrl, sample.alt, sample.shift, sample.keyCode, sample.inText, sample.location, result.length, held.release().length);
  console.log("keys", Object.keys(sample).join(","));
  console.log("references", sample !== full, sample.payload === full.payload, sample.callback === full.callback, sample.callback());
  const count = full.payload.count; sample.payload.count++; console.log("nested mutation", full.payload.count === count + 1); full.payload.count = count;
  const ctrl = full.ctrl; full.ctrl = false; console.log("snapshot", sample.ctrl === ctrl, full.kind, full.repeat); full.ctrl = ctrl;
}
function inspectOther(held: Held<string, Other>): void {
  held.note(other, "origin"); const first = held.release()[0]; if (!first) throw new Error("missing other release");
  console.log("other", first.from, first.sample.label, first.sample.kind, first.sample.repeat, first.sample.payload === other.payload, first.sample.callback === callback, Object.keys(first.sample).join(","));
}
function fullFirst(): void { const a = createHeld<number, Full>(), b = createHeld<string, Other>(); inspectFull(a); inspectOther(b); }
function otherFirst(): void { const b = createHeld<string, Other>(), a = createHeld<number, Full>(); inspectOther(b); inspectFull(a); }
fullFirst(); otherFirst();
console.log("direct", direct(full).ctrl, direct(other).label, direct(full).callback === callback);
const namedFull = named([{ sample: full, from: 1 }])[0], namedOther = named([{ sample: other, from: "two" }])[0];
if (!namedFull || !namedOther) throw new Error("missing named release");
console.log("named", namedFull.sample.ctrl, namedFull.sample.payload === full.payload, namedOther.sample.label);
interface Optional { tag?: string; extra: number; }
function optional<S extends Optional>(value: S): S & { tag?: string } { return { ...value }; }
const absent: Optional = { extra: 1 }, present: Optional = { tag: undefined, extra: 2 }, text: Optional = { tag: "text", extra: 3 };
for (const source of [absent, present, text]) {
  const copy = optional<Optional>(source);
  console.log("optional", "tag" in copy, Object.keys(copy).join(","), JSON.stringify(copy), copy !== source);
}
export {};
