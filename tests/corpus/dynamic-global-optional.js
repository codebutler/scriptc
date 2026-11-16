'use strict';
console.log('early', read() === undefined);
var registry = {};
Object.defineProperty(registry, 'read', {get: () => read, enumerable: true});
var value = Object.freeze({type: 'space', loc: null, text: ' '});
function read() { return value; }
console.log('after', JSON.stringify(registry.read()), Object.isFrozen(read()), read() === value);
try { value.text = 'changed'; } catch (error) { console.log('frozen', error instanceof TypeError); }
console.log('unchanged', read().text === ' ');
console.log('plain-before', readPlain() === undefined);
var plain = {count: 5};
function readPlain() { return plain; }
console.log('plain-after', readPlain().count);
for (let i = 0; i < 40; i++) {
  if (registry.read() !== value) throw new Error('identity');
}
console.log('recovered', read().type, plain.count);
