const methods = {
  forEach(fn) { fn(7); },
  reduce(fn, initial) { return fn(initial, 7); },
};
export function make() { return {children: Object.create(methods)}; }
export function walk(node) {
  const ref = node.children;
  return ref.reduce((sum, value) => sum + value, 0);
}
