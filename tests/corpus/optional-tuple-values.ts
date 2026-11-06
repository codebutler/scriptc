function show(value: [number, string?, boolean?]): void {
  console.log(value.length, value[0] + 1, value[1] ?? 'missing', value[2] ?? false,
    1 in value, 2 in value, JSON.stringify(value), Object.keys(value).join(','));
}
const a: [number, string?, boolean?] = [4];
show(a);
a[2] = true;
show(a);
a[1] = 'hello';
show(a);
delete a[1];
show(a);
a.length = 1;
show(a);
const explicit: [number, string?, boolean?] = [8, undefined, false];
show(explicit);
function readonly(value: readonly [number?, string?]): string {
  return `${value.length}:${value[0] ?? -1}:${value[1] ?? 'missing'}`;
}
console.log(readonly([]), readonly([2]), readonly([2, 'value']));
const nested: [string, [number, string?]?] = ['outer', [3, 'inner']];
console.log(nested[0], nested[1]?.[0], nested[1]?.[1]);
const fixed: [number] = [1];
const shared: [number, string?] = fixed;
fixed[0] = 2;
console.log(shared[0], fixed === shared);
shared[0] = 3;
console.log(fixed[0]);
function identity(value: [number, string?]) { return value; }
console.log(identity(shared) === shared);
