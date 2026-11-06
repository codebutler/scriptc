function create<T>(value: T) {
  return { call<R>(operation: (value: T) => R): R { return operation(value); } };
}
const store = create("record");
const operations: { call: () => void } = { call: () => 42 };
store.call<void>(operations.call);
