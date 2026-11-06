interface Kit {
  value: number;
  remembered: boolean;
  read(): number;
  bytes(input: ArrayBuffer | Uint8Array): number;
}
let escaped: () => number = () => -1;
let attempts = 0;
function remember(read: () => number): boolean {
  escaped = read;
  return true;
}
function fail(): number {
  attempts++;
  throw new Error("initializer failed");
}
function create(): Kit {
  const kit: Kit = {
    read() { return kit.value; },
    bytes(input) { return input.byteLength; },
    remembered: remember(() => kit.value),
    value: fail(),
  };
  return kit;
}
try {
  create();
} catch (error) {
  console.log(error instanceof Error && error.message === "initializer failed", attempts);
}
try {
  escaped();
} catch (error) {
  console.log(error instanceof ReferenceError);
}
