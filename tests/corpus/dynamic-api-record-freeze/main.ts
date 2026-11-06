import { make, read, set, same } from './library.mjs';
interface Api { value: number; child?: Api; call(): number; }
// An unrelated untyped freeze makes checked API layouts freezable.
const unrelated: unknown = Object.create(null);
Object.freeze(unrelated);
for (let index = 0; index < 2; index++) {
  const raw = make();
  const view = raw as Api;
  const twin = raw as Api;
  console.log(Object.isFrozen(view), view.child === view, view === twin, same(raw, view));
  view.value = 7;
  console.log(read(raw), view.call());
  set(raw, 9);
  console.log(view.value, twin.value);
  console.log(Object.freeze(view) === view, Object.isFrozen(raw), Object.isFrozen(view));
  try { twin.value = 11; } catch (error) { console.log('write', error instanceof TypeError); }
  try { Object.defineProperty(raw, 'value', { value: 12 }); }
  catch (error) { console.log('descriptor', error instanceof TypeError); }
  console.log(view.value, view.call(), view.child === twin);
  const otherRaw = make();
  const other = otherRaw as Api;
  Object.freeze(otherRaw);
  console.log(Object.isFrozen(other), other.value, other.call());
  try { other.value = 20; } catch (error) { console.log('alias', error instanceof TypeError); }
  const alreadyRaw = make();
  Object.freeze(alreadyRaw);
  const already = alreadyRaw as Api;
  console.log(Object.isFrozen(already), already.value, already.call(), same(alreadyRaw, already));
}
// A frozen native value of the selected shape must not be treated as a view.
const native: Api = { value: 31, child: undefined, call: () => 32 };
Object.freeze(native);
console.log('native', Object.isFrozen(native), native.value, native.call(), Object.hasOwn(native, 'value'));
try { native.value = 33; } catch (error) { console.log('native write', error instanceof TypeError); }
const copy = { ...native };
console.log('copy', copy.value, copy.call());
