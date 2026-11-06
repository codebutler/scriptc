// Discarded generic record calls still preserve callback results inside
// the erased callee. Contextual void does not erase JavaScript values.
function create<T>(value: T) {
  return {
    call<R>(operation: (value: T) => R): R {
      const result = operation(value);
      console.log("callback", result);
      return result;
    },
  };
}
const store = create("record");
store.call((value) => { console.log("side effect", value); });
store.call<void>((value) => value.length);
(store.call<void>((value) => value));
store["call"]<void>(() => 42);
store.call<void>(function (value) { return value + ":function"; });
const extracted = store.call;
extracted<void>(() => "extracted");
const numeric = (value: string): number => value.length + 1;
store.call<void>(numeric);
try {
  store.call<void>(() => { throw new Error("callback failed"); });
  console.log("unreachable");
} catch (error) {
  console.log("caught", error instanceof Error && error.message);
}
console.log("number", store.call((value) => value.length + 2));
