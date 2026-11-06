const syntaxFirst = SyntaxError.prototype;
console.log('prototype first', syntaxFirst.constructor === SyntaxError);
const TypeFirst = TypeError;
console.log('constructor first', TypeFirst.prototype.constructor === TypeFirst);

function check(Constructor, instance) {
  const prototype = Constructor.prototype;
  const bare = Object.create(prototype);
  console.log(Constructor.name, prototype === Constructor.prototype,
    prototype.constructor === Constructor, instance.constructor === Constructor,
    Object.getPrototypeOf(instance) === prototype,
    Object.getPrototypeOf(prototype) === (Constructor === Error ? Object.prototype : Error.prototype));
  console.log('brands', Error.isError(prototype), Error.isError(bare), Error.isError(instance),
    prototype instanceof Constructor, bare instanceof Constructor, bare instanceof Error,
    prototype instanceof Error);
  console.log('tags', Object.prototype.toString.call(prototype),
    Object.prototype.toString.call(bare), Object.prototype.toString.call(instance));
  console.log('keys', Object.keys(prototype).length, Object.getOwnPropertyNames(prototype).join(','),
    bare.toString(), prototype.toString === Error.prototype.toString);
  for (const key of ['constructor', 'name', 'message']) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
    console.log(key, descriptor.writable, descriptor.enumerable, descriptor.configurable,
      key === 'constructor' ? descriptor.value === Constructor : descriptor.value);
  }
  const ownPrototype = Object.getOwnPropertyDescriptor(Constructor, 'prototype');
  console.log('own prototype', ownPrototype.value === prototype, ownPrototype.writable,
    ownPrototype.enumerable, ownPrototype.configurable);
  const length = Object.getOwnPropertyDescriptor(Constructor, 'length');
  console.log('length', length.value, length.writable, length.enumerable, length.configurable);
  if (Constructor !== Error) console.log('constructor parent', Object.getPrototypeOf(Constructor) === Error);
  instance.name = 'Changed';
  console.log('changed name', instance.name, Object.getPrototypeOf(instance) === prototype,
    instance.constructor === Constructor, instance instanceof Constructor,
    instance.toString === Error.prototype.toString);
}
check(Error, new Error('message'));
check(TypeError, new TypeError('message'));
check(RangeError, new RangeError('message'));
check(SyntaxError, new SyntaxError('message'));
check(ReferenceError, new ReferenceError('message'));
check(EvalError, new EvalError('message'));
check(URIError, new URIError('message'));
check(AggregateError, new AggregateError([], 'message'));
check(SuppressedError, new SuppressedError('error', 'suppressed', 'message'));

console.log('direct instances', new Error().constructor === Error,
  new TypeError().constructor === TypeError, new RangeError().constructor === RangeError,
  new SyntaxError().constructor === SyntaxError, new ReferenceError().constructor === ReferenceError,
  new EvalError().constructor === EvalError, new URIError().constructor === URIError,
  new AggregateError([]).constructor === AggregateError,
  new SuppressedError(1, 2).constructor === SuppressedError);

console.log('direct', Error.prototype.constructor === Error,
  SyntaxError.prototype.constructor === SyntaxError,
  SyntaxError.prototype.toString === Error.prototype.toString);
const custom = Object.create(SyntaxError.prototype);
let reads = 0;
const source = { name: 'Custom', message: 'bad input', get stack() {
  reads++;
  return this.name + ': ' + this.message;
} };
console.log('assign', Object.assign(custom, source) === custom, custom.stack, reads);
const copiedStack = Object.getOwnPropertyDescriptor(custom, 'stack');
console.log('stack descriptor', typeof copiedStack.get, copiedStack.writable,
  copiedStack.enumerable, copiedStack.configurable);
console.log('custom brands', custom instanceof SyntaxError, custom instanceof TypeError,
  custom instanceof Error, Error.isError(custom));
try { throw custom; }
catch (error) { console.log('caught', error instanceof SyntaxError, error instanceof TypeError, error instanceof Error); }

const accessors = Object.create(RangeError.prototype);
const trace = [];
Object.defineProperty(accessors, 'name', { get() { trace.push('name'); return 'Named'; } });
Object.defineProperty(accessors, 'message', { get() { trace.push('message'); return 'detail'; } });
const stringify = Error.prototype.toString;
const methodDescriptor = Object.getOwnPropertyDescriptor(Error.prototype, 'toString');
console.log('method descriptor', methodDescriptor.value === stringify, methodDescriptor.writable,
  methodDescriptor.enumerable, methodDescriptor.configurable, stringify.name, stringify.length);
console.log('getters', stringify.call(accessors), trace.join(','));
console.log('direct call', Error.prototype.toString.call({ name: 'Direct', message: 'detail' }));
console.log('method identity', stringify === Error.prototype.toString,
  stringify === Object.getPrototypeOf(new Error()).toString,
  stringify === new Error().toString, stringify === new TypeError().toString);

class CustomError extends TypeError {}
const subclass = new CustomError('subclass');
console.log('subclass', Object.getPrototypeOf(CustomError.prototype) === TypeError.prototype,
  Object.getPrototypeOf(subclass) === CustomError.prototype,
  subclass instanceof CustomError, subclass instanceof TypeError, subclass instanceof Error);

for (const receiver of [null, undefined, false, 1, 'text', Symbol('tag'), 1n]) {
  try { stringify.call(receiver); }
  catch (error) { console.log('invalid receiver', error.name); }
}
class OverriddenError extends SyntaxError {
  toString() { return 'override:' + this.message; }
}
const overridden = new OverriddenError('detail');
console.log('override', overridden.toString(), overridden.toString === OverriddenError.prototype.toString,
  overridden.toString === stringify, stringify.call(overridden));


let borrowed;
const borrowedTrace = [];
class BorrowedError extends RangeError {
  detail = 'before';
  get name() {
    borrowedTrace.push('name:' + (this === borrowed));
    this.detail = 'after';
    return 'Named';
  }
  get message() {
    borrowedTrace.push('message:' + (this === borrowed));
    return this.detail;
  }
}
borrowed = new BorrowedError();
console.log('borrowed accessors', stringify.call(borrowed), borrowedTrace.join(','));

for (const stage of ['name-get', 'name-string', 'message-get', 'message-string']) {
  const steps = [];
  const thrown = { stage };
  const receiver = {
    get name() {
      steps.push('name-get:' + (this === receiver));
      if (stage === 'name-get') throw thrown;
      return { toString() {
        steps.push('name-string');
        if (stage === 'name-string') throw thrown;
        return 'Named';
      } };
    },
    get message() {
      steps.push('message-get:' + (this === receiver));
      if (stage === 'message-get') throw thrown;
      return { toString() {
        steps.push('message-string');
        throw thrown;
      } };
    }
  };
  try { stringify.call(receiver); }
  catch (error) { console.log('throwing', stage, error === thrown, steps.join(',')); }
}
