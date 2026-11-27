// A feature test of a built-in member that compares it with `void e` has one
// answer whatever `e` is, and `e` still runs: the operand must not disappear
// because the built-in is present. `void` evaluates an effectful operand and
// answers undefined; the comparison is between the untyped member and that
// value, an operator on an unknown value, which the compiler still refuses.
let calls = 0;
function note(label: string): number {
  calls++;
  console.log("note", label);
  return calls;
}

if (Array.prototype.at === void note("if-equal")) {
  Array.prototype.at = function () {
    return undefined;
  };
}

if (Array.prototype.at !== void note("if-unequal")) {
  console.log("present");
} else {
  Array.prototype.at = function () {
    return undefined;
  };
}

if (void note("left") == Array.prototype.at) {
  Array.prototype.at = function () {
    return undefined;
  };
}

Array.prototype.at !== void note("or") ||
  (Array.prototype.at = function () {
    return undefined;
  });

Array.prototype.at === void note("and") &&
  (Array.prototype.at = function () {
    return undefined;
  });

console.log(calls, [1, 2, 3].at(-1));
