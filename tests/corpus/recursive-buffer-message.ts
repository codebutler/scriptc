type Message =
  | undefined
  | null
  | boolean
  | number
  | string
  | ArrayBuffer
  | readonly Message[]
  | { readonly [key: string]: Message };
class Box<T> {
  readonly value: T;
  readonly receive: (v: T, m: Message) => Message;
  constructor(value: T, receive: (v: T, m: Message) => Message) {
    this.value = value;
    this.receive = receive;
  }
  call(m: Message): Message {
    return this.receive(this.value, m);
  }
}
const receiver = new Box("x", (_v: string, m: Message) => m);
const numeric = new Box(5, (v: number, m: Message) => (typeof m === "number" ? v + m : v));
console.log(numeric.call(6));
const buffer = new ArrayBuffer(4);
const view = new Uint8Array(buffer);
view[2] = 17;
const items: Message[] = [buffer, "first"];
const nested: { [key: string]: Message } = { items, buffer };
const held = receiver.call(nested);
items[1] = "second";
console.log(held === nested, receiver.call(items) === items, receiver.call(buffer) === buffer);
if (held && typeof held === "object" && "items" in held) {
  const a = held.items;
  if (Array.isArray(a)) console.log(a === items, a[0] === buffer, a[1]);
}
console.log(new Uint8Array(buffer)[2]);
const record = { a: 1 };
const out = receiver.call(record);
record.a = 9;
console.log(out === record, typeof out === "object" && out !== null && "a" in out && out.a);
const typed = [1, 2, 3];
const outArray = receiver.call(typed);
typed[1] = 99;
console.log(outArray === typed, Array.isArray(outArray) && outArray[1]);
nested.loop = nested;
const cycle = receiver.call(nested);
console.log(
  typeof cycle === "object" && cycle !== null && "loop" in cycle && cycle.loop === nested,
);
const fromJson = receiver.call(JSON.parse('{"a":1,"items":[2,3]}') as Message);
console.log(JSON.stringify(fromJson));
const returned = receiver.call(buffer);
if (returned instanceof ArrayBuffer) {
  const changed = new Uint8Array(returned);
  changed[2] = 71;
  console.log(returned.byteLength, view[2]);
}

export {};
