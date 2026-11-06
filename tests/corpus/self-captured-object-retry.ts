interface Kit {
  value(): number;
  read(): number;
  bytes(input: ArrayBuffer | Uint8Array): number;
}
function create(): Kit {
  const kit: Kit = {
    value() { return 7; },
    read() { return kit.value(); },
    bytes(input) { return input.byteLength; },
  };
  return kit;
}
const result = create();
console.log(result.read());
