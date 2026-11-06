function create<T>(value: T) {
  return { call<R>(operation: (value: T) => R): R { return operation(value); } };
}
const store = create("record");
const value = store.call<void>(() => 42);
console.log(value);
