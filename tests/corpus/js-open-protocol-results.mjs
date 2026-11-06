function generate(decorator) {
  let handlers = { value: "text", result() { return this.value; } };
  if (decorator) handlers = decorator(handlers);
  return handlers.result();
}
console.log(JSON.stringify(generate(null)));
console.log(JSON.stringify(generate((handlers) => ({
  ...handlers, result() { return [7]; },
}))));
let events = "";
function ordered(decorator) {
  let handlers = { value: "initial", result(arg) { return this.value + arg; } };
  if (decorator) handlers = decorator(handlers);
  function argument() {
    events += "arg;";
    handlers = { value: "replacement", result() { return "wrong"; } };
    return 3;
  }
  return handlers.result(argument());
}
console.log(JSON.stringify(ordered(() => ({
  value: 11,
  get result() {
    events += "get;";
    return function(arg) { events += "call;"; return [this.value, arg]; };
  },
}))), events);
let receivers = 0;
let keys = 0;
function nested(decorator) {
  let handlers = { child: { value: "nested", result() { return this.value; } } };
  if (decorator) handlers = decorator(handlers);
  function key() { keys++; return "result"; }
  return handlers.child[key()]();
}
console.log(JSON.stringify(nested(() => ({
  get child() { receivers++; return { value: 17, result() { return [this.value]; } }; },
}))), receivers, keys);
class Result {
  constructor(value) { this.value = value; }
  result() { return [this.value]; }
}
console.log(JSON.stringify(generate(() => new Result(23))));
events = "";
try {
  ordered(() => ({
    get result() { events += "throw;"; throw new Error("getter"); },
  }));
} catch (error) { console.log(error.message, events); }
