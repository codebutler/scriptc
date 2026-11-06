const methods = { call() { return this.value + 1; } };
export function make() {
  const value = Object.create(methods);
  value.value = 4;
  value.child = value;
  return value;
}
export function read(value) { return value.value; }
export function set(value, number) { value.value = number; }
export function same(left, right) { return left === right; }
