interface View { value(): number; child(): View; }
function factory(seed: number) {
  class Canvas implements View {
    readonly number: number;
    constructor(number: number) { this.number = number; }
    value() { return this.number; }
    child(): View { return wrap(this.number + 1); }
  }
  function wrap(value: number): View { return makeCanvas(value); }
  function makeCanvas(value: number = seed): View { return new Canvas(value); }
  return {create: makeCanvas, constructor: Canvas};
}
const first = factory(7);
const second = factory(20);
const initial = first.create();
const child = initial.child();
console.log(initial.value(), child.value(), second.create().child().value());
console.log(initial.constructor === first.constructor, child.constructor === first.constructor);
console.log(first.constructor !== second.constructor);
function shadowed() {
  class Canvas { value() { return 1; } }
  const outer = new Canvas();
  {
    class Canvas implements View {
      value() { return 2; }
      child(): View { return next(); }
    }
    function next(): View { return new Canvas(); }
    console.log(outer.value(), next().child().value(), outer.constructor === next().constructor);
  }
}
shadowed();
