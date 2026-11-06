let receivers = 0;
let keys = 0;
let calls = 0;
function key() { keys++; return 'result'; }
function evaluate(decorator) {
  let handlers = { make() { receivers++; return { result() { return "text"; } }; } };
  if (decorator) handlers = decorator(handlers);
  return handlers.make()[key()]();
}
console.log(JSON.stringify(evaluate(() => ({
  make() { receivers++; return { result() { calls++; return [19]; } }; },
}))), receivers, keys, calls);
function arrowFactory(decorator) {
  let handlers = { result() { return "arrow"; } };
  if (decorator) handlers = decorator(handlers);
  return () => handlers.result();
}
console.log(JSON.stringify(arrowFactory(() => ({ result() { return [23]; } }))()));
function expressionFactory(decorator) {
  let handlers = { result() { return "expression"; } };
  if (decorator) handlers = decorator(handlers);
  return function() { return handlers.result(); };
}
console.log(JSON.stringify(expressionFactory(() => ({ result() { return [29]; } }))()));
function methodFactory(decorator) {
  let handlers = { result() { return "method"; } };
  if (decorator) handlers = decorator(handlers);
  return { run() { return handlers.result(); } };
}
console.log(JSON.stringify(methodFactory(() => ({ result() { return [31]; } })).run()));
