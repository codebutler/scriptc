function defined<T extends object>(value: T): T {
  const result = {} as T;
  for (const key of Object.keys(value) as (keyof T)[]) {
    const field = value[key];
    if (field !== undefined) result[key] = field;
  }
  return result;
}
type Unit = { unit: "px" | "em"; value: number };
type Edge = number | Unit;
interface Options {
  width?: Edge;
  padding?: Edge | { left?: Edge; right?: Edge };
  label?: string;
  active?: boolean;
  items?: string[];
  callback?: (value: number) => number;
  clear?: null;
}
const unit: Unit = { unit: "px", value: 7 };
const padding: { left?: Edge; right?: Edge } = { left: unit };
const items = ["one"];
const callback = (value: number) => value + 4;
const input: Options = { label: "hello", width: unit, padding, active: undefined, items, callback, clear: null };
const output = defined(input);
console.log("keys", Object.keys(output).join(","));
console.log("copy", output !== input, output.width === unit, output.padding === padding);
console.log("refs", output.items === items, output.callback === callback, output.callback?.(3));
unit.value = 11;
items.push("two");
console.log("live", JSON.stringify(output));
console.log("empty", JSON.stringify(defined<Options>({})));
console.log("scalar", JSON.stringify(defined({ count: 3, text: "yes", missing: undefined })));

function assign<T extends object>(receiver: () => T, key: () => keyof T, value: () => T[keyof T]): void {
  receiver()[key()] = value();
}
interface Row { n?: number; text?: string; }
const first: Row = { n: 1, text: "first" };
const second: Row = { n: 2, text: "second" };
let current = first;
const events: string[] = [];
function receiver(): Row { events.push("receiver"); return current; }
function key(): keyof Row { events.push("key"); current = second; return "n"; }
function value(): Row[keyof Row] { events.push("value"); return 9; }
assign(receiver, key, value);
console.log("order", events.join(","), first.n, second.n);
const sentinel = new Error("value");
function thrown(): Row[keyof Row] { events.push("throw"); throw sentinel; }
try { assign(receiver, key, thrown); } catch (error) { console.log("throw", error === sentinel); }
console.log("unchanged", second.n);
assign(() => first, () => "text", () => "changed");
console.log("recovery", first.text);

const reversed: Row = {};
assign(() => reversed, () => "text", () => "first");
assign(() => reversed, () => "n", () => 4);
assign(() => reversed, () => "text", () => "last");
console.log("insert", Object.keys(reversed).join(","), JSON.stringify(reversed));
const partial = {} as Row;
assign(() => partial, () => "text", () => "partial");
assign(() => partial, () => "n", () => 5);
console.log("partial", Object.keys(partial).join(","), JSON.stringify(partial));
const raw = JSON.parse('{"extra":8,"text":"checked"}') as Row;
assign(() => raw, () => "n", () => 6);
console.log("checked", Object.keys(raw).join(","), JSON.stringify(raw));

delete reversed.text;
reversed.text = "again";
console.log("reinsert", Object.keys(reversed).join(","), JSON.stringify(reversed));
interface NumberKeys { "2"?: number; "1"?: number; text?: string; }
const numbers: NumberKeys = {};
assign(() => numbers, () => "text", () => "numbers");
assign(() => numbers, () => "2", () => 2);
numbers["1"] = 1;
console.log("numbers", Object.keys(numbers).join(","), JSON.stringify(numbers));

const frozen: Row = { text: "fixed" };
Object.freeze(frozen);
try { assign(() => frozen, () => "n", () => 7); } catch (error) { console.log("frozen", error instanceof TypeError); }
console.log("frozen keys", Object.keys(frozen).join(","));
