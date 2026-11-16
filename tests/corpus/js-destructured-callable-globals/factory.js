// A module-scope array pattern over a factory's [getter, setter] pair. The
// exported functions are hoisted above the declaration, so each binding is a
// lexical global read in its temporal dead zone, and the pattern's positions
// may be missing at run time.
function createCell(value) {
  let current = value;
  return [() => current, (next) => { current = next; }];
}

const [read, write] = createCell(false);
let [readCount, writeCount, missing] = createCell(0);

export function flag() {
  return read();
}

export function raise() {
  write(true);
}

export function store(value) {
  writeCount(value);
  return readCount();
}

export function absent() {
  return missing;
}

export function swap() {
  [readCount, writeCount] = createCell(100);
  return readCount();
}
