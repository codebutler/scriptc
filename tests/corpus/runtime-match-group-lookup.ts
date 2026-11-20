function inspect(row: RegExpExecArray, key: string) {
  if (!row.groups) {
    console.log("unnamed");
    return;
  }
  console.log("key", row.groups[key]);
  console.log("proto", row.groups["__proto__"]);
  console.log("constructor", row.groups.constructor);
}
function run(pattern: string, source: string) {
  for (const row of source.matchAll(new RegExp(pattern, "g"))) inspect(row, "word");
}
run("(?<word>a)|(?<other>b)", "ab");
run("z", "z");
function erase(v: unknown): any {
  return v;
}
function replace(row: RegExpExecArray) {
  const alias = erase(row);
  alias.groups = { token: "new" };
  console.log(row.groups?.["token"]);
  delete alias.groups;
  console.log(row.groups ? "present" : "missing");
}
const m = new RegExp("(?<word>a)").exec("a");
if (m) replace(m);

let calls = 0;
function name() {
  calls++;
  return "ghost";
}
function optional(m: RegExpExecArray | null) {
  console.log(m?.groups?.[name()], calls);
}
optional(null);
optional(new RegExp("x").exec("x"));
optional(new RegExp("(?<x>x)").exec("x"));
