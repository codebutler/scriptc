"use strict";
function build(flag) {
  const values = [];
  const entry = {name: "item", kind: false, nullable: false};
  if (flag) entry.kind = "node";
  values.push(entry);
  console.log("build", JSON.stringify(values), typeof entry.kind);
}
build(true); build(false);
function aliases() {
  const value = {kind: false, count: 1};
  const alias = value;
  function write() { value.kind = "list"; }
  write();
  console.log("alias", alias === value, alias.kind, value.count);
  value.kind = 17;
  console.log("number", alias.kind, typeof value.kind);
  value.kind = null;
  console.log("null", alias.kind === null);
  value.kind = undefined;
  console.log("undefined", alias.kind === undefined, Object.keys(value).join(","));
  return () => value;
}
const read = aliases();
console.log("capture", read() === read(), JSON.stringify(read()));
function accessor() {
  const value = {kind: false};
  let count = 0;
  let stored = "";
  Object.defineProperty(value, "kind", {
    get() { return stored; },
    set(next) { count++; stored = next; },
    configurable: true, enumerable: true,
  });
  value.kind = "node";
  console.log("accessor", value.kind, count);
}
accessor();
function frozen() {
  const value = {kind: false};
  Object.freeze(value);
  try { value.kind = "node"; }
  catch (error) { console.log("frozen", error instanceof TypeError, value.kind); }
}
frozen();
for (let i = 0; i < 40; i++) {
  const value = {kind: false};
  value.kind = "list";
  if (value.kind !== "list") throw new Error("wrong field");
}
console.log("recovered", true);

function returned(flag) {
  const value = {kind:false};
  if (flag) value.kind = "node";
  return value.kind;
}
console.log("return", returned(true), returned(false), typeof returned(true), typeof returned(false));
