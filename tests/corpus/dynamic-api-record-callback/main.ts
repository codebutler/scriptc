import { make, same, read } from "./library.mjs";
interface Api {
  value: number;
  plus(amount: number): number;
  visit(fn: (value: Api) => void): Api;
}
function exercise(): void {
  const original: unknown = make();
  const view = original as Api;
  console.log(view.plus(2), same(view, original));
  const result = view.visit((received) => {
    console.log(same(received, original), received === view);
    received.value = 8;
    console.log(received.plus(1));
  });
  console.log(result === view, same(result, original), read(original));
}
exercise();
exercise();
