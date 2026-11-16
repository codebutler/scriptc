type Numbers = number[] | Float32Array | Uint16Array;
function joined(value: Numbers, separator?: string): string {
  return value.join(separator);
}
const sparse = [1];
sparse[2] = 3;
const inputs: Numbers[] = [sparse, new Float32Array([1.5, -0, NaN, Infinity]), new Uint16Array([65535, 8]), [], new Float32Array(0)];
for (const value of inputs) {
  console.log('join', joined(value), joined(value, '|'), joined(value, ''), joined(value, '💙'));
}
let receiverCalls = 0;
let separatorCalls = 0;
let current: Numbers = sparse;
function receiver(): Numbers {
  receiverCalls++;
  console.log('receiver');
  return current;
}
function separator(): string {
  separatorCalls++;
  console.log('separator');
  sparse[1] = 7;
  current = new Float32Array([9]);
  return ':';
}
console.log('ordered', receiver().join(separator()), receiverCalls, separatorCalls);
console.log('later', receiver().join(undefined));
const sentinel = new Error('separator');
function fail(): string { console.log('fail'); throw sentinel; }
try { receiver().join(fail()); } catch (error) { console.log('throw', error === sentinel); }
class Box {
  reads = 0;
  get values(): Numbers { this.reads++; return new Float32Array([2.5, 4]); }
}
const box = new Box();
console.log('getter', box.values.join('-'), box.reads);
let total = 0;
for (let i = 0; i < 40; i++) total += joined(i % 2 ? [i, 2] : new Float32Array([i, 2]), ':').length;
console.log('owned', total, joined([5, 6]));
