let count = 0;
function effect(label: string): void { count++; console.log("effect", label, count); }
function objectValue(): { text: string } { effect("object"); return { text: "owned" }; }
function stringValue(): string { effect("string"); return "owned:" + count; }
function hiddenValue(): void { effect("hidden"); return JSON.parse('{"retained":true}'); }
const action: () => number | void = () => void effect("action");
console.log("action", action());
let state = "before";
const assign: (value: string) => number | void = value => void (state = value);
console.log("assign", assign("after"), state);
const record = { first: void objectValue(), second: void stringValue(), third: void hiddenValue() };
console.log("record", record.first, record.second, record.third);
const array = [void effect("array-1"), void effect("array-2")];
console.log("array", array.length, array[0], array[1]);
const yes = process.argv.length > 0;
console.log("conditional", yes ? void effect("taken") : 42);
const short = void (yes && effect("and"));
const skipped = void (!yes && effect("wrong-and"));
console.log("short", short, skipped);
const nested = void (void effect("nested"));
console.log("nested", nested);
function withDefault(value = 42): number { console.log("default", value); return value; }
console.log("argument", withDefault(void effect("argument")));
const sentinel = { message: "same" };
function throwing(): number { effect("throw"); throw sentinel; }
try { const result = { value: void throwing() }; console.log("unreachable", result.value); }
catch (error) { console.log("caught", error === sentinel); }
finally { console.log("finally", count); }
const source = {
 get method(): () => number {
  effect("getter");
  return () => { effect("call"); return 7; };
 },
};
const getterResult = void source.method();
console.log("getter", getterResult);
const recovered = void effect("recover");
console.log("recover", recovered, count);

if (void effect("feature-test") == Array.prototype.at) console.log("wrong-feature");
console.log("feature-done", count);
