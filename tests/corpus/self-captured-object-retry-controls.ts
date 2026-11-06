interface Kit {
  value(): number;
  read(): number;
}
function create(seed: number): Kit {
  const kit: Kit = {
    value() { return seed; },
    read() { return kit.value(); },
  };
  return kit;
}
const first = create(7);
const second = create(20);
console.log(first.read(), second.read());
