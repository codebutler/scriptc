interface Link { value: number; next?: Link; }
const link: Link = { value: 5 };
link.next = link;
let reads = 0;
const literal = { link, get value() { reads++; return this.link.value; } };
const boxed: object = literal;
const view = Reflect.get(boxed, "link");
console.log(view === link, Reflect.get(view, "next") === view, reads);
Reflect.set(view, "value", 9);
console.log(link.value, Reflect.get(boxed, "value"), reads);
link.value = 13;
console.log(Reflect.get(view, "value"));
Reflect.set(view, "next", view);
console.log(link.next === link);
