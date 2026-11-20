const events = [];
class Meta {
  constructor(id) {
    this.id = id;
  }
}
Meta.tag = new Meta(7);
class Child extends Meta {}
function prop(key) {
  if (typeof key !== "string") throw new TypeError("key");
  return Meta[key];
}
function child(key) {
  if (typeof key !== "string") throw new TypeError("key");
  return Child[key];
}
console.log(prop("tag") === Meta.tag, child("tag") === Meta.tag, child("missing") === undefined);
const replacement = new Meta(11);
Reflect.set(Meta, "tag", replacement);
console.log(prop("tag") === replacement, child("tag") === replacement, events.join(","));

const descriptor = Object.getOwnPropertyDescriptor(Meta, "tag");
console.log(descriptor.value === replacement, descriptor.enumerable, descriptor.writable);
class WithAccessor extends Meta {
  static get own() {
    events.push("getter");
    return this.tag;
  }
}
console.log(Reflect.get(WithAccessor, "own") === replacement, events.join(","));
