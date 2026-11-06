// The flattened fixed-arity rest ABI does not expose the original argument count.
function capture(...args: [number, string?]): [number, string?] {
  return args;
}
console.log(capture(1).length);
