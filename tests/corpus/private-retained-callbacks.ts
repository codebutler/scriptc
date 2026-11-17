// Fresh private aggregates retain closures until a later field read.
class Retained<T> {
  #owner = { read: () => this.#value, write: (value: T) => { this.#value = value; } };
  #value: T;
  constructor(value: T) { this.#value = value; }
  callbacks() { return this.#owner; }
}
const numberBox = new Retained(3);
const stringBox = new Retained("first");
const numbers = numberBox.callbacks();
const strings = stringBox.callbacks();
console.log("initial", numbers.read(), strings.read());
numbers.write(7);
strings.write("later");
console.log("updated", numbers.read(), strings.read());
class Nested {
  #owner = { nested: { read: () => this.#value } };
  #callbacks = [() => this.#value + 1];
  #value = 9;
  read() { return this.#owner.nested.read(); }
  next() { return this.#callbacks[0]!(); }
}
const nested = new Nested();
console.log("nested", nested.read(), nested.next());
function register(owner: { read: () => number }): void {
  console.log("registered", owner.read());
}
class Registered {
  #owner = { read: () => this.#value };
  #value = 12;
  constructor() { register(this.#owner); }
}
new Registered();
export {};
