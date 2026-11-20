import "./direct.js";

function frames(error: Error, effects: string[]): string {
  function delimiter(): string {
    effects.push("split");
    return "\n";
  }
  function start(): number {
    effects.push("slice");
    return 1;
  }
  return error.stack?.split(delimiter()).slice(start()).join(",") ?? "missing";
}
const error = new Error("first");
const effects: string[] = [];
error.stack = "title\nA\nB";
console.log(frames(error, effects), effects.join(","));
error.stack = undefined;
console.log(frames(error, effects), effects.join(","), error.stack);
error.stack = "";
console.log(frames(error, effects), effects.join(","));
error.stack = "before delete";
function untyped(value: unknown): any {
  return value;
}
const alias = untyped(error);
delete alias.stack;
console.log(frames(error, effects), Object.hasOwn(alias, "stack"));
Object.defineProperty(alias, "stack", {
  configurable: true,
  get() {
    effects.push("get");
    return "title\nC";
  },
});
console.log(frames(error, effects), effects.join(","));
