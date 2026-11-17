// An effectful void operand must run even in a built-in feature test.
// These guards cannot be folded without evaluating the operand. Explicit
// void sequencing is supported; the unresolved prototype member still
// reaches the static-only unknown-operator fence. The operand must not
// disappear merely because the built-in is present.
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
