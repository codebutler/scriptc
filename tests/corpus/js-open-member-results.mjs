function generate(decorator) {
  let handlers = { result() { return "text"; } };
  if (decorator) handlers = decorator(handlers);
  return handlers.result();
}
console.log(JSON.stringify(generate(null)));
console.log(JSON.stringify(generate((handlers) => ({ ...handlers, result() { return [7]; } }))));
console.log(JSON.stringify(generate(() => ({ result() { return 9; } }))));
console.log(JSON.stringify(generate(() => ({ result() { return undefined; } }))));
function computed(decorator, key) {
  let handlers = { result() { return "computed"; } };
  if (decorator) handlers = decorator(handlers);
  return (handlers[key])();
}
console.log(JSON.stringify(computed(() => ({ result() { return [11]; } }), 'result')));
function nested(decorator) {
  let handlers = { inner: { result() { return "nested"; } } };
  if (decorator) handlers = decorator(handlers);
  return handlers.inner.result();
}
console.log(JSON.stringify(nested(() => ({ inner: { result() { return [13]; } } }))));
function property(decorator) {
  let handlers = { value: "property" };
  if (decorator) handlers = decorator(handlers);
  return handlers.value;
}
console.log(JSON.stringify(property(() => ({ value: 17 }))));
