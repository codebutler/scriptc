const methods = {
  plus(amount) { return this.value + amount; },
};
export function make() {
  const child = Object.create(methods);
  child.value = 4;
  const root = Object.create(methods);
  root.value = 7;
  root.child = child;
  root.twin = child;
  root.optional = undefined;
  root.extra = 17;
  child.child = root;
  return root;
}
export function valueOf(object) { return object.value; }
export function setValue(object, value) { object.value = value; }
export function same(left, right) { return left === right; }
export function childOf(object) { return object.child; }
