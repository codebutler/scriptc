class Resource {
  #value = 1;
  value(): number { return this.#value; }
}
class Picture extends Resource {}
class Surface extends Resource {}
function describe(resource: Resource): string {
  return resource.constructor.name;
}
for (const resource of [new Resource(), new Picture(), new Surface()]) {
  console.log(describe(resource), resource.value());
}
function factory() {
  return class Local extends Resource {};
}
const First = factory();
const Second = factory();
console.log(describe(new First()), describe(new Second()), First === Second);
function direct() {
  class Direct extends Resource {}
  return new Direct();
}
console.log("direct", describe(direct()));
let reads = 0;
function next(): Resource { reads++; return new Picture(); }
console.log(next().constructor.name, reads);
const shadow = new Surface();
Object.defineProperty(shadow, "constructor", { value: { name: "Own" } });
console.log(describe(shadow));
class OwnConstructor {
  ["constructor"] = { name: "Field" };
}
console.log(new OwnConstructor().constructor.name);

const first = new First();
const second = new Second();
console.log("factory identity", first.constructor === First, second.constructor === Second);
Reflect.defineProperty(First.prototype, "constructor", {
  configurable: true,
  get: function (this: Resource) {
    console.log("getter receiver", this === first);
    return { name: "Getter" };
  },
});
console.log(describe(first), describe(second));
Reflect.deleteProperty(First.prototype, "constructor");
console.log("deleted", describe(first), describe(second));
Object.defineProperty(first, "constructor", { value: { name: "Instance" } });
console.log("own override", describe(first));
