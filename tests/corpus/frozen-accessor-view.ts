interface View {
  readonly items: number[];
  readonly data: number;
  current: number;
  inspect(): number;
}
const effects: string[] = [];
function freezeView(items: number[]): View {
  let n = 1;
  return Object.freeze({
    items,
    data: 4,
    get current() {
      effects.push("get");
      return n;
    },
    set current(value: number) {
      effects.push("set");
      n = value;
    },
    inspect() {
      return n;
    },
  } satisfies View);
}
const list = [7];
const v = freezeView(list);
console.log(Object.isFrozen(v), v.items === list, v.inspect(), effects.length);
v.current = 5;
console.log(v.current, v.inspect(), effects.join(","));
v.items.push(8);
console.log(list.join(","));
const d = Object.getOwnPropertyDescriptor(v, "current");
console.log(d?.configurable, d?.enumerable, typeof d?.get, typeof d?.set, effects.length);
console.log(Reflect.set(v, "data", 9), v.data, Reflect.deleteProperty(v, "current"));

interface Throwing {
  readonly last: number;
}
const failure = new Error("from getter");
function throwing(): Throwing {
  return Object.freeze({
    get last(): number {
      throw failure;
    },
  } satisfies Throwing);
}
const handle = throwing();
console.log(Object.isFrozen(handle));
try {
  console.log(handle.last);
} catch (e) {
  console.log(e === failure);
}
