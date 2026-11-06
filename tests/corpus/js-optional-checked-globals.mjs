console.log('direct-before', parse() === undefined);
var space = Object.freeze({type: 'WhiteSpace', loc: null, value: ' '});
function parse() { return space; }
console.log('direct-after', parse() === space, parse().type, Object.isFrozen(parse()));
try { parse().value = 'bad'; } catch (error) { console.log('frozen', error instanceof TypeError); }

console.log('array-before', readArray() === undefined);
var array = Object.freeze([1, 2]);
function readArray() { return array; }
console.log('array-after', readArray() === array, readArray()[0]);

try { lexical(); } catch (error) { console.log('tdz', error instanceof ReferenceError); }
let pending = Object.freeze({value: 'ready'});
function lexical() { return pending; }
console.log('lexical', lexical() === pending, lexical().value);

try { constant(); } catch (error) { console.log('const-tdz', error instanceof ReferenceError); }
const fixed = Object.freeze({value: 'fixed'});
function constant() { return fixed; }
console.log('constant', constant() === fixed, constant().value);

const values = [{value: 1}];
let index = 4;
var item = values[index];
function selected() { return item; }
console.log('missing', selected() === undefined);
index = 0;
item = values[index];
console.log('selected', selected() === values[0], selected().value);
