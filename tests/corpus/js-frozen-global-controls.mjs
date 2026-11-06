/** @type {{ value: string }} */
const annotated = Object.freeze({value: 'annotated'});
function readAnnotated() { return annotated.value; }
console.log(readAnnotated());

function shadowed() {
  const Object = {freeze(value) { return value; }};
  const item = Object.freeze({value: 'mutable'});
  item.value = 'changed';
  return item.value;
}
console.log(shadowed());
