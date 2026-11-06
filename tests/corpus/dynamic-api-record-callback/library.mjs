class Service {
  #secret = 7;
  value = 3;
  plus(amount) { return this.#secret + this.value + amount; }
  visit(fn) { fn(this); return this; }
}
export function make() { return new Service(); }
export function same(a, b) { return a === b; }
export function read(service) { return service.value; }
