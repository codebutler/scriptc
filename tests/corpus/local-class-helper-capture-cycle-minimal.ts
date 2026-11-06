interface View { value(): number; child(): View; }
function make() {
  class Canvas implements View {
    value() { return 7; }
    child(): View { return makeCanvas(); }
  }
  function makeCanvas(): View { return new Canvas(); }
  return makeCanvas();
}
console.log(make().child().value());
