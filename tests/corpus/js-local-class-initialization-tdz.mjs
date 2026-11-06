function direct() {
  class C { static value = C.name; static read() { return C; } }
  return C.value + ':' + (C.read() === C);
}
console.log('direct', direct());
function indirect() {
  class C {
    static value = read();
    child() { return read(); }
  }
  function read() { return C; }
  return C;
}
try { indirect(); } catch (error) { console.log('indirect', error.name); }
let saved;
function failed() {
  class C {
    static value = fail();
    child() { return read(); }
  }
  function read() { return C; }
  function fail() { saved = read; throw new Error('init'); }
  return C;
}
try { failed(); } catch (error) { console.log('failed', error.message); }
try { saved(); } catch (error) { console.log('after-failure', error.name); }
function computed() {
  class C {
    [key()]() { return 1; }
    child() { return read(); }
  }
  function read() { return C; }
  function key() { return read().name; }
  return C;
}
try { computed(); } catch (error) { console.log('computed', error.name); }
let keyReader;
function keyCapture() {
  class C {
    [key()]() { return 3; }
  }
  function key() { keyReader = () => C; return 'value'; }
  return C;
}
const keyed = keyCapture();
console.log('key-reader', keyReader() === keyed);

