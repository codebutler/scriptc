// Typed method calls in a program with untyped computed-key writes. Each call
// reads its method slot, so an instance without own properties reads the
// method from its class's prototype; the calls must still honor prototype
// replacements, subclass overrides and own properties added later.
// @ts-ignore
import { overwrite, setOwn } from "./untyped.mjs";

class Sink {
  len = 0;
  byte(x: number): Sink {
    this.len += x;
    return this;
  }
}

class Doubling extends Sink {
  byte(x: number): Sink {
    this.len += 100 * x;
    return this;
  }
}

class Plain extends Sink {}

function fill(s: Sink, n: number): number {
  for (let i = 0; i < n; i++) s.byte(i & 3).byte(1);
  return s.len;
}

console.log(Object.keys(overwrite({ a: 0, b: 0 })).join(","));
const all: Sink[] = [new Sink(), new Doubling(), new Plain()];
console.log(all.map((s) => fill(s, 1000)).join(","));

const original = Sink.prototype.byte;
Sink.prototype.byte = function (this: Sink, x: number): Sink {
  this.len -= x;
  return this;
};
for (const s of all) s.byte(1);
console.log(all.map((s) => s.len).join(","));

Sink.prototype.byte = original;
for (const s of all) s.byte(1);
console.log(all.map((s) => s.len).join(","));

const third = all[2]!;
setOwn(third, "byte", (x: number): Sink => {
  console.log("own byte", x);
  return third;
});
for (const s of all) s.byte(2);
console.log(all.map((s) => s.len).join(","));
console.log(fill(new Sink(), 10), fill(new Plain(), 10));
