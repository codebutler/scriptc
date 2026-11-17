let effects = 0;
const sentinel = { message: "original" };
function mark(label: string): number { console.log("effect", label, ++effects); return effects; }
function absent(label: string): undefined { mark(label); return undefined; }
function fail(): undefined { mark("throw"); throw sentinel; }
async function main(): Promise<void> {
  console.log("start");
  await new Promise<void>(resolve => resolve(undefined));
  console.log("void-direct");
  await new Promise<undefined>(resolve => resolve(undefined));
  console.log("undefined-direct");
  await new Promise<void>(resolve => setTimeout(() => resolve(undefined), 1));
  console.log("void-timer");
  await new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 1));
  console.log("undefined-timer");
  await new Promise<void>(resolve => resolve(void mark("explicit-void")));
  await new Promise<undefined>(resolve => resolve(absent("call")));
  console.log("undefined-effect");
  await new Promise<void>(resolve => resolve((mark("comma"), undefined)));
  try { await new Promise<undefined>(resolve => resolve(fail())); }
  catch (error) { console.log("identity", error === sentinel); }
  await new Promise<void>(resolve => { resolve(undefined); resolve(fail()); });
  console.log("settled-before-throw", effects);
  await new Promise<void>(resolve => queueMicrotask(() => resolve(void mark("captured"))));
  console.log("done", effects);
}
void main();
