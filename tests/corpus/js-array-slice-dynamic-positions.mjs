function show(label, value) {
  console.log(label, value.length, value.join('|'), Object.keys(value).join(','));
}
function basic(start, end) {
  const values = [10, 20, 30, 40];
  return values.slice(start, end);
}
show('undefined', basic(undefined, undefined));
show('null', basic(null, null));
show('strings', basic('1.8', '3.9'));
show('boolean', basic(true, false));
show('NaN', basic(NaN, NaN));
show('infinite', basic(-Infinity, Infinity));
show('negative', basic(-3, -1));
show('reversed', basic(3, 1));
function omitted(start) {
  const values = ['a', 'b', 'c'];
  return values.slice(start);
}
show('omitted', omitted(1));
for (const bound of [Symbol('index'), 1n]) {
  try { basic(bound, undefined); }
  catch (error) { console.log('start throws', error.name, error.message); }
  try { basic(0, bound); }
  catch (error) { console.log('end throws', error.name, error.message); }
}

function mutation(start, end, extra) {
  const values = [10, 20, 30, 40];
  const trace = [];
  function first() { trace.push('start arg'); return start(values, trace); }
  function second() { trace.push('end arg'); return end(values, trace); }
  function third() { trace.push('extra arg'); extra(values); return 0; }
  const result = (trace.push('receiver'), values).slice(first(), second(), third());
  show('mutation', result);
  console.log(trace.join(','), values.join('|'));
}
mutation(
  (values, trace) => ({ get valueOf() {
    trace.push('start getter');
    return () => { trace.push('start convert'); values.pop(); values.pop(); return 1; };
  } }),
  (values, trace) => ({ valueOf() { trace.push('end convert'); return 4; } }),
  (values) => { values.push(50); },
);
mutation(
  (values, trace) => ({ valueOf() {
    trace.push('start convert'); values.push(50); values.push(60); return 0;
  } }),
  (values, trace) => ({ valueOf() { trace.push('end convert'); values.pop(); return Infinity; } }),
  (values) => {},
);
mutation(
  (values, trace) => ({ valueOf() { trace.push('start convert'); return 3; } }),
  (values, trace) => ({ valueOf() {
    trace.push('end convert'); values.length = 1; return 4;
  } }),
  (values) => {},
);
mutation(
  (values, trace) => ({ valueOf() { trace.push('start convert'); return 2; } }),
  (values, trace) => ({ valueOf() {
    trace.push('end convert'); values.push(50); return 1;
  } }),
  (values) => {},
);

function throwing(start, end) {
  const values = [1, 2, 3];
  const trace = [];
  function first() { trace.push('first'); return start(trace); }
  function second() { trace.push('second'); return end(trace); }
  try { values.slice(first(), second()); }
  catch (error) { console.log('throw', error.name, error.message, trace.join(',')); }
}
throwing(
  (trace) => ({ get valueOf() { trace.push('getter'); throw new Error('bad getter'); } }),
  (trace) => ({ valueOf() { trace.push('unused'); return 2; } }),
);
throwing(
  (trace) => ({ valueOf() { trace.push('start'); return 0; } }),
  (trace) => ({ valueOf() { trace.push('end'); throw new Error('bad end'); } }),
);

function holes(start, end) {
  const values = [1, , undefined, 4];
  return values.slice(start, end);
}
show('holes', holes(0, 4));
function references(start) {
  const item = { value: 1 };
  const values = [item];
  const result = values.slice(start);
  result[0].value = 9;
  console.log('identity', result !== values, result[0] === item, item.value);
}
references(0);

function foreign(start) {
  const values = [1, 2, 3];
  return values.slice(start(values), 3);
}
show('foreign', foreign((values) => ({ valueOf() {
  values[1] = 'changed';
  return 0;
} })));

function fallback(start) {
  const values = [10, 20, 30];
  return values.slice(start);
}
show('toString fallback', fallback({
  valueOf() { console.log('valueOf fallback'); return {}; },
  toString() { console.log('toString fallback'); return '1'; },
}));
try {
  fallback({ valueOf() { return {}; }, toString() { return {}; } });
} catch (error) {
  console.log('nonprimitive throws', error.name, error.message);
}
