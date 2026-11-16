type Values = Float32Array | Uint16Array | number[];
function copy(value: Values | null | undefined): number[] {
  if (value == null) return [];
  return Array.from(value);
}
function property(box: { values?: Values }): number[] {
  if (!box.values) return [];
  return Array.from(box.values);
}
const ordinary = [1, 2, 3];
const floats = new Float32Array([1.5, 2.25]);
const words = new Uint16Array([65535, 8]);
console.log('values', copy(ordinary).join(','), copy(floats).join(','), copy(words).join(','));
console.log('absent', copy(null).length, copy(undefined).length, property({}).length);
const fresh = property({values: ordinary});
fresh[0] = 40;
console.log('fresh', ordinary[0], fresh[0], fresh === ordinary);
let reads = 0;
class Selected {
  get values(): Values | undefined {
    reads++;
    return reads === 1 ? ordinary : floats;
  }
  copy(): number[] {
    if (!this.values) return [];
    return Array.from(this.values);
  }
}
console.log('getter', new Selected().copy().join(','), reads);
const sentinel = new Error('getter');
let throwingReads = 0;
class Throwing {
  get values(): Values | undefined {
    if (++throwingReads === 2) throw sentinel;
    return words;
  }
  copy(): number[] {
    if (!this.values) return [];
    return Array.from(this.values);
  }
}
try { new Throwing().copy(); } catch (error) { console.log('throw', error === sentinel, throwingReads); }
const sparse: number[] = [1];
sparse[2] = 3;
const dense = copy(sparse);
console.log('holes', sparse.join(','), dense.join(','), 1 in dense);
let total = 0;
for (let i = 0; i < 40; i++) total += property({values: new Float32Array([i, 1])})[0]!;
console.log('owned', total, property({values: words}).join(','));
