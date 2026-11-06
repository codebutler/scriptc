function simple() {
  class Item { value() { return 3; } }
  return new Item().value();
}
function capturesValue(value: number) {
  class Item { read() { return value; } }
  return new Item().read();
}
function forwardVariable() {
  function read() { return value; }
  const getter = read;
  let value = 7;
  return getter();
}
function capturedClass() {
  class Item { value() { return 9; } }
  const create = () => new Item();
  return create().value();
}
console.log(simple(), capturesValue(5), forwardVariable(), capturedClass());
