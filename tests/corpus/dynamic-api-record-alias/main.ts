import { make, valueOf, setValue, same, childOf } from "./library.mjs";
interface Api {
  value: number;
  plus(amount: number): number;
  child?: Api;
  twin?: Api;
  optional?: number;
}
interface Native { value: number; plus(amount: number): number; mark: boolean; }
interface Other { value: number; plus(amount: number): number; label?: string; }
function equalViews(a: Api | Other, b: Api | Other): boolean { return a === b; }
function exercise(): void {
  const original = make();
  const view = original as Api;
  const again = original as Api;
  const other = original as Other;
  console.log(view === again, view === other, same(view, original), view.plus(2), view.value);
  console.log(equalViews(view, other));
  const typed = new Map<Api, string>();
  typed.set(view, "one");
  console.log(typed.get(again), typed.size);
  const mixed = new Map<Api | Other, string>();
  mixed.set(view, "first");
  mixed.set(other, "second");
  console.log(mixed.size, mixed.get(again));
  const set = new Set<Api | Other>([view, again, other]);
  console.log(set.size, set.has(other));
  console.log("plus" in view, Object.hasOwn(view, "plus"), "extra" in view);
  console.log("optional" in view, Object.hasOwn(view, "optional"));
  delete view.optional;
  console.log("optional" in view, Object.hasOwn(view, "optional"));
  console.log(Object.keys(view).join(","));
  console.log(Object.entries(view).map(([key]) => key).join(","));
  view.value = 8;
  console.log(valueOf(original));
  setValue(original, 9);
  console.log(view.value, view.plus(1));
  const child = view.child;
  if (child === undefined) throw new Error("missing child");
  console.log(same(child, childOf(original)), same(child.child, original), child === view.twin);
  child.value = 12;
  console.log(valueOf(childOf(original)), child.plus(1));
  const native: Native = { value: 30, plus: (amount) => amount + 30, mark: true };
  const unknownNative: unknown = native;
  const nativeView = unknownNative as Api;
  const nativeMixed = new Map<Api | Native, string>();
  nativeMixed.set(native, "native");
  console.log(nativeMixed.get(nativeView), nativeMixed.size);
  nativeMixed.set(nativeView, "view");
  console.log(nativeMixed.get(native), nativeMixed.size);
  const nativeSet = new Set<Api | Native>([nativeView, native]);
  console.log(nativeSet.size, nativeSet.has(native));
  const replacement: Api = { value: 20, plus: (amount) => amount + 20 };
  view.child = replacement;
  replacement.value = 21;
  console.log(same(childOf(original), replacement), view.child.value);
}
exercise();
exercise();
