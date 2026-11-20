// Calc reads pixels from a canvas that can return either typed array, or null.
type Pixels = Float32Array | Uint8Array | null | undefined;

function pixel(pixels: Pixels, index: number): number | null | undefined {
  if (pixels == null) return null;
  return pixels[index];
}

function offset(pixels: Pixels, index: number) {
  if (pixels == null) return null;
  return 1 + pixels[index]!;
}

const floats = new Float32Array([0, -1.5, 3.25]);
const bytes = new Uint8Array([9, 255]);
for (const index of [-1, 0, 0.5, 1, 2]) {
  console.log(pixel(floats, index), pixel(bytes, index), pixel(null, index), offset(bytes, index));
}

type Values = number[] | Uint8Array | null | undefined;
let current: Values = null;
let events = "";
function receiver(value: Values): Values {
  events += "r";
  return value;
}
function replace() {
  events += "k";
  current = [90];
  return 0;
}
function readAndReplace(value: Values) {
  current = value;
  return receiver(current)![replace()];
}
console.log(readAndReplace([41]), readAndReplace(new Uint8Array([17])), events);
for (const missing of [null, undefined]) {
  try {
    readAndReplace(missing);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    console.log(error.name, error.message, events);
  }
}

const sentinel = new Error("index failed");
function fail(): number {
  events += "e";
  throw sentinel;
}
try {
  receiver(null)![fail()];
} catch (error) {
  console.log(error === sentinel, events);
}
export {};
