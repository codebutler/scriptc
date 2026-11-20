const events: string[] = [];
class Box {
  value = 0;
}
const box = new Box();
class Base {
  static hits = 0;
  static prepare(value: Box): Box {
    this.hits++;
    events.push("static");
    value.value += 1;
    return value;
  }
}
class Cache {
  hits = 0;
  prepare(value: Box): Box {
    this.hits++;
    events.push("cache");
    value.value += 2;
    return value;
  }
}
const cache = new Cache();
function select(c: Cache | null | undefined) {
  events.push("select");
  return c;
}
function replace(c: Cache | null | undefined) {
  events.push("arg");
  if (c)
    Reflect.set(c, "prepare", function (v: Box) {
      events.push("next cache");
      v.value += 3;
      return v;
    });
  else
    Reflect.set(Base, "prepare", function (v: Box) {
      events.push("next static");
      v.value += 4;
      return v;
    });
  return box;
}
function fallback() {
  events.push("fallback");
  return Base;
}
function run(c: Cache | null | undefined) {
  return (select(c) ?? fallback()).prepare(replace(c));
}
console.log(run(null) === box, run(null) === box, run(cache) === box, run(cache) === box);
console.log(Base.hits, cache.hits, box.value, events.join(","));

interface Wider {
  count: number;
  extra: string;
}
interface Small {
  count: number;
}
class Default {
  static run(a: Small) {
    a.count++;
    return a;
  }
}
class Instance {
  run(a: Small) {
    a.count += 2;
    return a;
  }
}
function use(c: Instance | undefined, a: Wider) {
  return (c ?? Default).run(a);
}
const data: Wider = { count: 0, extra: "keep" };
console.log(
  use(undefined, data) === data,
  use(new Instance(), data) === data,
  data.count,
  data.extra,
);

class AsyncFactory {
  static async read(fn: () => Box) {
    await Promise.resolve();
    return fn();
  }
}
class AsyncCache {
  async read(fn: () => Box) {
    await Promise.resolve();
    return fn();
  }
}
function read(cache: AsyncCache | undefined, fn: () => Box) {
  return (cache ?? AsyncFactory).read(fn);
}
console.log(
  (await read(undefined, () => box)) === box,
  (await read(new AsyncCache(), () => box)) === box,
);
export {};
