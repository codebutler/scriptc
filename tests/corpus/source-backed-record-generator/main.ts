import { make, next, same } from "./library.mjs";
interface Api { value: number; plus(n: number): number; }
function* values(value: Api): Generator<Api, Api, unknown> { yield value; return value; }
const original = make();
const view = original as Api;
const iterator = values(view);
const first = next(iterator);
console.log(first.done, same(first.value, original));
view.value = 9;
console.log(first.value.value, first.value.plus(2));
const last = next(iterator);
console.log(last.done, same(last.value, original), same(last.value, first.value));
