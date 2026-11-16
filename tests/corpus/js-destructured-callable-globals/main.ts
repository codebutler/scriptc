import { absent, flag, raise, store, swap } from "./factory.js";

console.log(flag());
raise();
console.log(flag());
console.log(store(1), store(2));
console.log(absent() === undefined);
console.log(swap(), store(3));
