import { performance as imported } from "node:perf_hooks";
import * as hooks from "node:perf_hooks";

const origin = performance.timeOrigin;
const before = Date.now();
const first = performance.now();
const aligned = origin + first;
const after = Date.now();
console.log(typeof origin, Number.isFinite(origin), origin > 0);
console.log(origin === globalThis.performance.timeOrigin, origin === imported.timeOrigin, origin === hooks.performance.timeOrigin);
// Bracket the reading; the allowance covers platform clock resolution, not a deadline.
console.log(aligned >= before - 100 && aligned <= after + 100, origin <= after + 100);
await Promise.resolve();
console.log(performance.timeOrigin === origin, performance.now() >= first);
function shadowed(): number {
  const performance = { timeOrigin: 17 };
  return performance.timeOrigin;
}
console.log(shadowed(), typeof performance.timeOrigin);
