console.log('early', read() === undefined);
var record = {value: 7};
function read() { return record; }
console.log('record', read().value);
const values = [3, 4];
let index = 5;
var item = values[index];
function selected() { return item; }
console.log('missing', selected() === undefined);
index = 0;
item = values[index];
console.log('selected', selected());
