type Response = Promise<void> | { type: string } | void;
const seen = new WeakSet<Promise<unknown>>();
const failure = { message: "original" };
let notifications = 0;
function observe(p: Promise<unknown>, label: string): void {
  console.log("seen", label, seen.has(p));
  if (seen.has(p)) return;
  seen.add(p);
  void p.then(
    value => { notifications++; console.log("fulfilled", label, value); seen.delete(p); },
    reason => { notifications++; console.log("rejected", label, reason === failure); seen.delete(p); },
  );
}
function route(handler: () => Response, label: string): void {
  const returned = handler();
  if (returned instanceof Promise) observe(returned, label);
  else console.log("sync", label, returned === undefined);
}
class Observer {
  observe(p: Promise<unknown>): void { observe(p, "method"); }
}
function routeMethod(handler: () => Response, owner: Observer): void {
  const value = handler();
  if (value instanceof Promise) owner.observe(value);
}
function widen(value: Response): Promise<unknown> {
  if (value instanceof Promise) return value;
  return Promise.resolve("fallback");
}
function data(handler: () => Promise<string> | { type: string } | void): void {
  const returned = handler();
  if (returned instanceof Promise) observe(returned, "data");
}
function mixed(handler: () => Promise<number> | Promise<string> | { type: string }): void {
  const value = handler();
  if (value instanceof Promise) observe(value, "mixed");
}
async function main(): Promise<void> {
  const first = Promise.resolve();
  route(() => first, "first");
  route(() => first, "again");
  routeMethod(() => first, new Observer());
  console.log("identity", widen(first) === first, seen.has(first));
  await first;
  console.log("settled", seen.has(first), notifications);
  const second = Promise.reject<void>(failure);
  route(() => second, "failure");
  route(() => second, "failure-again");
  console.log("rejection-identity", widen(second) === second);
  try { await second; } catch (reason) { console.log("caught", reason === failure); }
  console.log("rejection-settled", seen.has(second), notifications);
  const text = Promise.resolve("payload");
  data(() => text);
  await text;
  mixed(() => Promise.resolve(17));
  mixed(() => Promise.resolve("seventeen"));
  await Promise.resolve();
  route(() => ({ type: "consume" }), "record");
  route(() => {}, "empty");
  console.log("fallback", await widen(undefined));
  route(() => first, "reobserve");
  await first;
  console.log("done", notifications, seen.has(first));
}
void main();
