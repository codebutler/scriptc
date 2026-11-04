// A string-keyed write into a nested dictionary whose values may be functions.
// Such a dictionary is a native record, never a class instance, so the write
// cannot replace a method and typed method calls stay direct. A dictionary
// that holds an existing instance (a view) still replaces its methods.
type Fn = (...args: unknown[]) => unknown;

class Entry {
  hits = 0;
}

class Counter {
  count = 0;
  add(x: number): Counter {
    this.count += x;
    return this;
  }
}

function imports(): { module: string; name: string }[] {
  return [
    { module: "env", name: "memory" },
    { module: "env", name: "add" },
    { module: "wasi", name: "fd_write" },
  ];
}

const tables: Record<string, Record<string, Fn | Entry>> = { env: {}, wasi: {} };
for (const imp of imports()) tables[imp.module]![imp.name] = new Entry();
tables["env"]!["log"] = (...args: unknown[]): unknown => args.length;
console.log(Object.keys(tables["env"]!).join(","), Object.keys(tables["wasi"]!).join(","));
const log = tables["env"]!["log"];
console.log(typeof log === "function" ? log(1, 2, 3) : "entry");

const c = new Counter();
for (let i = 0; i < 1000; i++) c.add(i & 7).add(1);
console.log(c.count);

// A view of an existing instance: writing a method name through it replaces
// the method, as in JavaScript.
const view = c as unknown as Record<string, Fn | number>;
const names = ["add"];
for (const name of names)
  view[name] = (x: unknown): unknown => {
    console.log("replaced add", x);
    return c;
  };
c.add(5);
console.log(c.count);
