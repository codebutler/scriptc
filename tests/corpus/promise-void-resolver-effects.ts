let count = 0;
const sentinel = new Error("operand");
function effect(label: string, fail = false): void {
  console.log("effect", label, ++count);
  if (fail) throw sentinel;
}
function enqueue<T>(value: T): Promise<T> {
  return new Promise<T>(resolve => {
    const callback = (input: unknown) => { resolve(input as T); };
    queueMicrotask(() => callback(value));
  });
}
async function main(): Promise<void> {
  console.log("start");
  await new Promise<void>(resolve => {
    resolve(effect("first"));
    console.log("executor");
    resolve(effect("second"));
  });
  console.log("settled", count);
  await new Promise<void>((function(resolve) { resolve(effect("function")); }));
  try {
    await new Promise<void>(resolve => resolve(effect("throw", true)));
  } catch (error) { console.log("identity", error === sentinel); }
  await new Promise<void>(resolve => {
    resolve();
    resolve(effect("after-settle", true));
  });
  console.log("after-settle");
  await enqueue<void>(undefined);
  console.log("generic-void");
  console.log("generic-number", await enqueue(17));
  await new Promise<void>(resolve => {
    queueMicrotask(() => resolve(effect("captured")));
  });
  await new Promise<void>(resolve => resolve(Promise.resolve()));
  console.log("adopted", count);
}
void main();
