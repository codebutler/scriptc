interface State {
  line: number | null;
  lines: number[] | null;
  flag: boolean;
  extra: number;
  spare: number[];
}
type Key = "line" | "lines";
function read(s: State, k: Key): number | number[] | null | undefined {
  return s[k];
}
function narrow(k: string): Key {
  return k as Key;
}
const list = [7];
const state: State = { line: 1, lines: list, flag: true, extra: 3, spare: list };
console.log(
  read(state, narrow("extra")),
  read(state, narrow("spare")) === list,
  read(state, narrow("missing")),
);

const other: State = { line: null, lines: null, flag: false, extra: 8, spare: [] };
let target = state;
const trace: string[] = [];
function key(): Key {
  trace.push("key");
  target = other;
  return "lines";
}
function receiver(): State {
  trace.push("receiver");
  return target;
}
console.log(receiver()[key()] === list, trace.join(","), target === other);
function optional(s: State | undefined, k: () => Key) {
  return s?.[k()];
}
console.log(optional(undefined, key), trace.join(","));
console.log(optional(other, key), trace.join(","));
interface Mark {
  pos: number;
}
interface SymbolInfo {
  label: string;
}
interface Code {
  marks: Mark[];
  symbols: SymbolInfo[];
  flag: boolean;
}
function fromCode(s: Code, k: "marks" | "symbols") {
  return s[k];
}
const marks: Mark[] = [{ pos: 2 }];
const symbols: SymbolInfo[] = [{ label: "j" }];
const source: Code = { marks, symbols, flag: true };
console.log(fromCode(source, "marks") === marks, fromCode(source, "symbols") === symbols);
