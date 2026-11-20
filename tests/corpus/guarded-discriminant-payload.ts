type Action =
  | { kind: "write"; bytes: Uint8Array }
  | { kind: "search"; query: string }
  | { kind: "focus" }
  | { kind: "ignore" };
type Input =
  | { kind: "write"; bytes: Uint8Array }
  | { kind: "search"; query: string }
  | { kind: "focus"; focused: boolean }
  | { kind: "clear" };
let last: Input | null = null;
function send(input: Input) {
  last = input;
}
function forward(action: Action) {
  if (action.kind === "write" || action.kind === "search") send(action);
}
function check(action: Action) {
  last = null;
  forward(action);
  return (last as unknown) === action;
}
console.log(
  check({ kind: "write", bytes: new Uint8Array([7]) }),
  check({ kind: "search", query: "abc" }),
  check({ kind: "focus" }),
  check({ kind: "ignore" }),
);
