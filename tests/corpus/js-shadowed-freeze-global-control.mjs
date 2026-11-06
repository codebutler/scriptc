const Object = {freeze(value) { return value; }};
const readItem = read;
var item = Object.freeze({value: 'mutable'});
function read() { return item; }
readItem().value = 'changed';
console.log(readItem() === item, item.value);
