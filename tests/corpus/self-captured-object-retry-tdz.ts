interface Kit {
  value: number;
  early: boolean;
  read(): number;
  bytes(input: ArrayBuffer | Uint8Array): number;
}
let inspections = 0;
function inspect(read: () => number): boolean {
  inspections++;
  try {
    read();
    return false;
  } catch (error) {
    return error instanceof ReferenceError;
  }
}
function create(seed: number): Kit {
  let kit: Kit = {
    value: seed,
    early: inspect(() => kit.value),
    read() { return kit.value; },
    bytes(input) { return input.byteLength; },
  };
  const original = kit;
  kit = {
    value: seed + 10,
    early: false,
    read() { return -1; },
    bytes(input) { return input.byteLength; },
  };
  return original;
}
const first = create(7);
const second = create(20);
console.log(first.early, second.early, inspections);
console.log(first.read(), second.read());
console.log(first.bytes(new Uint8Array(3)), second.bytes(new ArrayBuffer(5)));
