class Base {
  matches(value) { return false; }
}
class Factory {
  static from(value) {
    if (value instanceof Leaf) return value;
    return new Leaf();
  }
}
class Leaf extends Base {
  matches(value) {
    if (!(value instanceof Leaf)) return super.matches(value);
    return true;
  }
}

function replaceMethod() {
  Leaf.prototype.matches = function () { return false; };
}
const leaf = Factory.from({});
console.log(leaf.matches(leaf), leaf.matches({}), Factory.from(leaf) === leaf);
replaceMethod();
console.log(leaf.matches(leaf), Factory.from(leaf) === leaf);
