// Inherited `this` results retain their descendant class inside an optional
// chain. Explicit optional array elements/members exercise the same result
// union even when the caller's tsconfig omits noUncheckedIndexedAccess.
const events: string[] = [];

function argument(label: string): string {
  events.push(`arg:${label}`);
  return label;
}

function report(label: string): void {
  console.log(label, events.join("|"));
  events.length = 0;
}

class Base {
  count = 0;
  touch(label: string): this {
    events.push(`touch:${label}`);
    this.count++;
    return this;
  }
}

class Item extends Base {
  extra = 42;
  maybe(present: boolean): Item | undefined {
    events.push(`maybe:${present}`);
    return present ? this : undefined;
  }
}

class Deeper extends Item {
  detail = 7;
}

function local(value: Item | null | undefined): void {
  const result = value?.touch(argument("local")).touch(argument("local-tail"));
  console.log("local", result === value, result?.extra, result?.count);
}

local(undefined);
local(null);
report("local absent");
local(new Item());
report("local present");

class Holder {
  #value: Item | undefined;
  set(value: Item | undefined): void {
    this.#value = value;
  }
  run(): void {
    const result = this.#value?.touch(argument("private")).touch(argument("private-tail"));
    console.log("private", result === this.#value, result?.extra, result?.count);
  }
}

const holder = new Holder();
holder.run();
report("private absent");
holder.set(new Item());
holder.run();
report("private present");
holder.set(undefined);
holder.run();
report("private cleared");

function indexed(items: ({ row: Item } | undefined)[], index: number): void {
  const result = items[index]?.row.touch(argument("element")).touch(argument("element-tail"));
  console.log("element", result?.extra, result?.count);
}

indexed([], 0);
indexed([undefined], 0);
report("element absent");
indexed([{ row: new Item() }], 0);
report("element present");

function optionalRow(items: ({ row?: Item } | undefined)[], index: number): void {
  const result = items[index]?.row?.touch(argument("row")).touch(argument("row-tail"));
  console.log("row", result?.extra, result?.count);
}

optionalRow([], 0);
optionalRow([undefined], 0);
optionalRow([{}], 0);
report("row absent");
optionalRow([{ row: new Item() }], 0);
report("row present");

let current: Item | undefined;
let reads = 0;
const source = {
  get current(): Item | undefined {
    events.push("receiver:get");
    reads++;
    return current;
  },
};
function read(): void {
  const result = source.current?.touch(argument("getter")).touch(argument("getter-tail"));
  console.log("getter result", result === current, result?.extra);
}
read();
report("getter absent");
current = new Item();
read();
console.log("receiver reads", reads, current.count);
report("getter present");

function descendant(value: Deeper | undefined): void {
  const result = value?.touch(argument("deep")).touch(argument("deep-tail"));
  console.log("descendant", result === value, result?.extra, result?.detail, result?.count);
}
descendant(undefined);
report("descendant absent");
descendant(new Deeper());
report("descendant present");

// Observing and replacing the base method preserves each real receiver and
// the member-get/argument/call order. All replacement results are valid.
const originalTouch = Base.prototype.touch;
console.log("observed", typeof originalTouch);
function observed(value: Deeper | undefined): void {
  const result = value?.touch(argument("observed")).touch(argument("observed-tail"));
  console.log("observed result", result === value, result?.extra, result?.detail, result?.count);
}
observed(new Deeper());
report("prototype original");
Object.defineProperty(Base.prototype, "touch", {
  configurable: true,
  writable: true,
  value: function (this: Base, label: string): Base {
    events.push(`replacement:${label}`);
    this.count += 2;
    return this;
  },
});
observed(undefined);
report("replacement absent");
observed(new Deeper());
report("prototype replacement");
let methodReads = 0;
Object.defineProperty(Base.prototype, "touch", {
  configurable: true,
  get() {
    methodReads++;
    events.push("method:get");
    return function (this: Base, label: string): Base {
      events.push(`getter-call:${label}`);
      this.count += 3;
      return this;
    };
  },
});
observed(undefined);
report("method getter absent");
observed(new Deeper());
console.log("method reads", methodReads);
report("prototype getter");
Object.defineProperty(Base.prototype, "touch", {
  configurable: true,
  writable: true,
  value: originalTouch,
});
observed(new Deeper());
report("prototype restored");

// A method's own undefined result stays undefined when its receiver exists.
function intrinsic(value: Item | undefined): void {
  const absent = value?.maybe(false);
  const present = value?.maybe(true);
  const skipped = value?.maybe(false)?.touch(argument("intrinsic-skipped"));
  console.log("intrinsic", absent === undefined, present === value, present?.extra, skipped === undefined);
}
intrinsic(undefined);
report("intrinsic receiver absent");
intrinsic(new Item());
report("intrinsic receiver present");

export {};
