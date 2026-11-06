const readSpace = parseSpace;
console.log('before', readSpace() === undefined);
var space = Object.freeze(({type: 'WhiteSpace', loc: null, value: ' '}));
function parseSpace() { return space; }
console.log('object', readSpace() === space, readSpace().type, Object.isFrozen(readSpace()));
try { readSpace().value = 'changed'; } catch (error) { console.log('frozen', error instanceof TypeError); }
console.log('value', space.value);

const arrayReader = () => readArray;
console.log('array-before', arrayReader()() === undefined);
var array = Object.freeze(([1, 2, 3]));
function readArray() { return array; }
console.log('array', arrayReader()() === array, array.length, Object.isFrozen(array));

const readConst = constant;
try { readConst(); } catch (error) { console.log('const-tdz', error instanceof ReferenceError); }
const fixed = Object.freeze({value: 'constant'});
function constant() { return fixed; }
console.log('const', readConst() === fixed, fixed.value);

const readLet = lexical;
try { readLet(); } catch (error) { console.log('let-tdz', error instanceof ReferenceError); }
let changing = Object.freeze({value: 'first'});
function lexical() { return changing; }
console.log('let', readLet() === changing, changing.value);
changing = Object.freeze({value: 'second'});
console.log('changed', readLet() === changing, changing.value);

var later = Object.freeze({value: 'later'});
const laterReader = readLater;
function readLater() { return later; }
console.log('later', laterReader() === later, later.value);

const plainReader = readPlain;
var plain = {value: 'plain'};
function readPlain() { return plain; }
console.log('plain', plainReader() === plain, plain.value);
