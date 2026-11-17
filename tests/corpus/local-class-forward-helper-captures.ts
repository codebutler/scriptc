function factory(seed: number) {
  let value = seed;
  class Item {
    value = value;
    again(): Item { return surface(); }
    static label = "item";
  }
  function surface(): Item { return canvas(); }
  function canvas(): Item { return new Item(); }
  const first = surface();
  value += 1;
  return { first, next: canvas, constructor: Item };
}
const one = factory(17);
const two = factory(29);
console.log(one.first.value, one.first.again().value, two.first.value, two.first.again().value);
console.log(one.next().value, one.constructor.label, one.constructor !== two.constructor);
console.log(one.first instanceof one.constructor, one.first instanceof two.constructor);

function blocks() {
  const items: number[] = [];
  for (let value = 0; value < 3; value++) {
    class Item {
      number = value;
      next(): Item { return make(); }
    }
    function make(): Item { return construct(); }
    function construct(): Item { return new Item(); }
    const first = make();
    items.push(first.number, first.next().number);
  }
  return items.join(",");
}
console.log(blocks());

const failure = new Error("construction");
function recover(fail: boolean) {
  class Item {
    constructor() { if (fail) throw failure; }
    again(): Item { return make(); }
  }
  function make(): Item { return construct(); }
  function construct(): Item { return new Item(); }
  return make();
}
try { recover(true); } catch (error) { console.log(error === failure); }
console.log(recover(false).again() !== null);
