// The unknown[] representation crosses the checked-dynamic combinator,
// then returns typed settled records without adding observable reaction turns.
const events: string[] = [];

function ticker(label: string): void {
  let turn = 0;
  const step = (): void => {
    events.push(label + turn++);
    if (turn < 7) Promise.resolve().then(step);
  };
  Promise.resolve().then(step);
}

function report(label: string): void {
  console.log(label, events.join(" | "));
  events.length = 0;
}

async function empty(): Promise<void> {
  const input: unknown[] = [];
  ticker("empty tick ");
  const completion = Promise.allSettled(input);
  completion.then((results) => events.push("empty then " + results.length));
  Promise.resolve().then(() => events.push("empty marker"));
  events.push("empty sync");
  const results = await completion;
  events.push("empty await " + results.length);
  // Drain the ticker so successive cases do not share its outstanding jobs.
  for (let i = 0; i < 8; i++) await Promise.resolve();
  report("empty");
}

async function identities(): Promise<void> {
  const objectValue = { id: 17 };
  const objectReason = { code: "object rejection" };
  const error = new RangeError("same error");
  const input: unknown[] = [
    objectValue,
    Promise.resolve(objectValue),
    error,
    Promise.resolve(),
    23,
    undefined,
    Promise.reject("primitive rejection"),
    Promise.reject(objectReason),
    Promise.reject(error),
  ];
  ticker("identity tick ");
  const completion = Promise.allSettled(input);
  completion.then(() => events.push("identity then"));
  Promise.resolve().then(() => events.push("identity marker"));
  events.push("identity sync");
  const results = await completion;
  events.push("identity await");
  console.log("identity statuses", results.map((result) => result.status).join(","));
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    if (result.status === "fulfilled") {
      console.log("fulfilled", i, result.value === objectValue, result.value === error,
        result.value === undefined, result.value === 23);
    } else {
      console.log("rejected", i, result.reason === "primitive rejection",
        result.reason === objectReason, result.reason === error);
    }
  }
  console.log("result records distinct", results[0] !== results[1]);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  report("identities");
}

type ResolveUnknown = (value: unknown) => void;
type RejectUnknown = (reason: unknown) => void;
const thenableValue = { id: 41 };
const getterReason = { code: "getter throw" };
let getterReads = 0;
let thenCalls = 0;

class ObservedThenable {
  tag = "original receiver";

  get then(): (this: ObservedThenable, resolve: ResolveUnknown, reject: RejectUnknown) => void {
    getterReads++;
    events.push("then getter " + this.tag);
    return function (this: ObservedThenable, resolve: ResolveUnknown, reject: RejectUnknown): void {
      thenCalls++;
      events.push("then call " + (this === thenable) + " " + this.tag);
      resolve(thenableValue);
      resolve("ignored second resolve");
      reject("ignored reject");
      throw new Error("ignored throw after resolve");
    };
  }
}

class ThrowingThenGetter {
  get then(): never {
    events.push("throwing then getter");
    throw getterReason;
  }
}

const thenable = new ObservedThenable();

class MethodThenable {
  tag = "method receiver";

  then(resolve: ResolveUnknown): void {
    events.push("method then " + (this === methodThenable) + " " + this.tag);
    resolve(thenableValue);
  }
}

const methodThenable = new MethodThenable();

async function thenables(): Promise<void> {
  const input: unknown[] = [
    Promise.resolve("left"), thenable, new ThrowingThenGetter(), "right", methodThenable,
  ];
  ticker("thenable tick ");
  events.push("before call");
  const completion = Promise.allSettled(input);
  events.push("after call");
  completion.then(() => events.push("thenable result then"));
  Promise.resolve().then(() => events.push("thenable marker"));
  const results = await completion;
  events.push("thenable await");
  const adopted = results[1]!;
  const failed = results[2]!;
  const method = results[4]!;
  console.log("thenables", getterReads, thenCalls,
    adopted.status === "fulfilled" && adopted.value === thenableValue,
    failed.status === "rejected" && failed.reason === getterReason,
    method.status === "fulfilled" && method.value === thenableValue,
    results.map((result) => result.status).join(","));
  for (let i = 0; i < 8; i++) await Promise.resolve();
  report("thenable order");
}

// PromiseResolve's getter runs between iterator steps, so an appended
// element belongs to this invocation rather than just the next one.
async function getterAppendsDuringConsumption(): Promise<void> {
  const pending: unknown[] = [{
    get then(): (resolve: (value: number) => void) => void {
      events.push("append getter");
      pending.push(2);
      return (resolve: (value: number) => void): void => {
        events.push("append then call");
        resolve(1);
      };
    },
  }];
  ticker("append tick ");
  const completion = Promise.allSettled(pending);
  events.push("append after call " + pending.length);
  completion.then(() => events.push("append result then"));
  Promise.resolve().then(() => events.push("append marker"));
  const results = await completion;
  events.push("append await");
  console.log("appended results", JSON.stringify(results));
  for (let i = 0; i < 8; i++) await Promise.resolve();
  report("append order");
}

// The asserted type does not make this primitive iterable. The call must
// return a rejected promise before its TypeError is observed asynchronously.
async function invalidIterable(): Promise<void> {
  const input = 42 as unknown as unknown[];
  ticker("iterator tick ");
  const completion = Promise.allSettled(input);
  events.push("iterator call returned");
  Promise.resolve().then(() => events.push("iterator marker"));
  const typeError = await completion.then(
    () => false,
    (failure: unknown) => {
      events.push("iterator rejected");
      return failure instanceof TypeError;
    },
  );
  events.push("iterator await");
  console.log("invalid iterable TypeError", typeError);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  report("iterator order");
}

class InputHolder {
  reads = 0;
  input: unknown[];

  constructor(input: unknown[]) {
    this.input = input;
  }

  get values(): unknown[] {
    this.reads++;
    events.push("read input");
    return this.input;
  }
}

async function delayedAndConsumed(): Promise<void> {
  let finish!: (value: number) => void;
  const delayed = new Promise<number>((resolve) => { finish = resolve; });
  const held = { id: 71 };
  const input: unknown[] = [delayed, held, "kept"];
  const holder = new InputHolder(input);
  let receiverReads = 0;
  function receiver(): InputHolder {
    receiverReads++;
    events.push("read receiver");
    return holder;
  }
  ticker("delayed tick ");
  const completion = Promise.allSettled(receiver().values);
  completion.then(() => events.push("delayed result then"));
  events.push("after consumption");
  input[0] = "replacement";
  input[1] = { id: 999 };
  input.length = 1;
  input.push(new ThrowingThenGetter());
  Promise.resolve().then(() => {
    events.push("release delayed");
    finish(89);
  });
  Promise.resolve().then(() => events.push("delayed marker"));
  const results = await completion;
  events.push("delayed await");
  const first = results[0]!;
  const second = results[1]!;
  const third = results[2]!;
  console.log("consumed", receiverReads, holder.reads, results.length,
    first.status === "fulfilled" && first.value === 89,
    second.status === "fulfilled" && second.value === held,
    third.status === "fulfilled" && third.value === "kept");
  for (let i = 0; i < 8; i++) await Promise.resolve();
  report("delayed order");
}

async function main(): Promise<void> {
  await empty();
  await identities();
  await thenables();
  await getterAppendsDuringConsumption();
  await invalidIterable();
  await delayedAndConsumed();
}

main();
