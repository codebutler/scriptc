type Value = { value: number };
type Callback = (input: number) => number;
class Provider {
  source: Value | (() => Value);
  constructor(source: Value | (() => Value)) { this.source = source; }
  read(): Value { return typeof this.source === "function" ? this.source() : this.source; }
}
console.log("data", new Provider({ value: 3 }).read().value);
console.log("callback", new Provider(() => ({ value: 7 })).read().value);
const events: string[] = [];
const sentinel = new Error("original");
class Mixed {
  factor = 20;
  value: Callback | Value;
  constructor(value: Callback | Value) { this.value = value; }
  replace(): number { events.push("argument"); this.value = { value: 5 }; return 2; }
  fail(): number { events.push("argument-throw"); throw sentinel; }
  invalidate(): void { events.push("invalidate"); this.value = { value: 9 }; }
  saved(): number {
    if (typeof this.value === "function") return this.value(this.replace());
    return -1;
  }
  invalidated(): number {
    if (typeof this.value === "function") {
      this.invalidate();
      return this.value(this.replace());
    }
    return -1;
  }
  argumentThrows(): number {
    if (typeof this.value === "function") return this.value(this.fail());
    return -1;
  }
  call(input: number): number {
    if (typeof this.value === "function") return this.value(input);
    return this.value.value;
  }
}
function callback(this: Mixed, input: number): number {
  events.push("callback");
  return this.factor + input;
}
const saved = new Mixed(callback);
console.log("saved", saved.saved(), saved.call(0), events.join(","));
events.length = 0;
try { new Mixed(callback).invalidated(); }
catch (error) { console.log("invalidated", error instanceof TypeError, events.join(",")); }
events.length = 0;
try { new Mixed(callback).argumentThrows(); }
catch (error) { console.log("argument", error === sentinel, events.join(",")); }
const throwing = new Mixed(() => { throw sentinel; });
try { throwing.call(1); } catch (error) { console.log("callback-error", error === sentinel); }
throwing.value = callback;
console.log("recovered", throwing.call(4));
class Derived extends Mixed {}
console.log("inherited", new Derived(callback).call(6));
class Optional {
  value: ((value?: number) => number) | Value | null;
  constructor(value: ((value?: number) => number) | Value | null) { this.value = value; }
  call(): number { return typeof this.value === "function" ? this.value() : -1; }
}
console.log("default", new Optional((value = 8) => value).call());
console.log("null", new Optional(null).call());
