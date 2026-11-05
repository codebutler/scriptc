type Resolve = (value: unknown) => void;

function resolved(value: unknown): Promise<unknown> {
  return Promise.resolve(value);
}
function constructed(value: unknown): Promise<unknown> {
  return new Promise<unknown>((resolve) => resolve(value));
}
async function both(label: string, value: unknown): Promise<void> {
  console.log(label, String(await resolved(value)), String(await constructed(value)));
}

await both("plain", 42);
await both("promise", Promise.resolve("native"));
await both("nested", { then(resolve: Resolve) { resolve(Promise.resolve("nested")); } });
await both("recursive", {
  then(resolve: Resolve) { resolve({ then(next: Resolve) { next("deep"); } }); },
});

const original: unknown = Promise.resolve("identity");
const same: unknown = resolved(original);
const different: unknown = constructed(original);
console.log("identity", original === same, original === different);
await different;

const receiver = {
  label: "receiver",
  then(resolve: Resolve) { resolve(this.label); },
};
await both("receiver", receiver);
class Thenable {
  label: string;
  constructor(label: string) { this.label = label; }
  then(resolve: Resolve): void { resolve(this.label); }
}
await both("class", new Thenable("method"));
await both("executor receiver", {
  then(resolve: Resolve) {
    resolve(new Promise<unknown>(function (this: unknown, done) {
      done(this === undefined ? "undefined" : "wrong receiver");
    }));
  },
});

for (const construct of [false, true]) {
  const events: string[] = [];
  let reads = 0;
  const value: unknown = {
    get then() {
      if (++reads > 1) throw new Error("read twice");
      events.push("get");
      return (resolve: Resolve): void => {
        events.push("then");
        resolve("done");
      };
    },
  };
  const promise = construct ? constructed(value) : resolved(value);
  events.push("after");
  console.log("order", construct, String(await promise), reads, events.join(","));
}

await both("noncallable", { then: 7, toString() { return "value"; } });
for (const construct of [false, true]) {
  const reject = async (label: string, value: unknown): Promise<void> => {
    try {
      await (construct ? constructed(value) : resolved(value));
      console.log("unexpected fulfillment", label);
    } catch (error) {
      console.log("rejected", construct, label, error instanceof Error ? error.message : "wrong error");
    }
  };
  await reject("get", { get then(): unknown { throw new Error("getter"); } });
  await reject("call", { then(): void { throw new Error("call"); } });
  await reject("promise", Promise.reject(new Error("native")));
}

console.log("first", String(await new Promise<unknown>((resolve, reject) => {
  resolve({ then(next: Resolve) { next(Promise.resolve("first")); } });
  reject(new Error("second"));
  resolve("third");
  throw new Error("fourth");
})));
let finish: Resolve = () => {};
const pending = new Promise<unknown>((resolve) => { finish = resolve; });
const adoptedPending = new Promise<unknown>((resolve, reject) => {
  resolve(pending);
  reject(new Error("too late"));
  throw new Error("also too late");
});
finish("pending first");
console.log("pending", String(await adoptedPending));

console.log("then first", String(await constructed({
  then(resolve: Resolve, reject: (error: Error) => void) {
    resolve(Promise.resolve("winner"));
    reject(new Error("late"));
    throw new Error("later");
  },
})));
try {
  await new Promise<unknown>((resolve, reject) => {
    reject(new Error("first rejection"));
    resolve(Promise.resolve("late"));
  });
} catch (error) {
  console.log("reject first", error instanceof Error ? error.message : "wrong error");
}
try {
  await new Promise<unknown>(() => { throw new Error("executor"); });
} catch (error) {
  console.log("throws", error instanceof Error ? error.message : "wrong error");
}

let settle: Resolve = () => {};
const cycle = new Promise<unknown>((resolve) => { settle = resolve; });
settle(cycle);
try { await cycle; } catch (error) { console.log("cycle", error instanceof TypeError); }
