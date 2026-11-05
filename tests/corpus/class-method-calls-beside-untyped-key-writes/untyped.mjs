// Untyped computed-key writes: each can replace a method of any class, so
// every typed method call in the program reads its method slot first.
export function overwrite(v) {
  for (const k of Object.keys(v)) v[k] = 1;
  return v;
}

export function setOwn(o, k, v) {
  o[k] = v;
}
