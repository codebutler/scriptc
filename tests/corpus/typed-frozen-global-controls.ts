const typed: Readonly<{ value: string }> = Object.freeze({value: 'typed'});
const inferred = Object.freeze({value: 'inferred'});
const list = Object.freeze([1, 2, 3]);
console.log(typed.value, inferred.value, list[1], Object.isFrozen(inferred));
