// No direct Error.prototype spelling: constructor aliases must preserve identity.
const Constructor = Error;
const TypeConstructor = TypeError;
const error = new Error('message');
console.log(error.toString === Constructor.prototype.toString);
console.log(new TypeError('typed').toString === TypeConstructor.prototype.toString);
const method = error.toString;
console.log(method.call(error));
