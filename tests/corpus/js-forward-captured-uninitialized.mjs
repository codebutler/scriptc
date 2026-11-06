function scan() {
  function number() { type = 12; }
  function word() { type = 1; }
  function read() { return type; }
  let type;
  console.log("initial", read());
  number();
  console.log("number", read());
  word();
  console.log("word", read());
}
scan();

function temporal() {
  const read = () => type;
  const write = () => { type = "early"; };
  for (const operation of [read, write]) {
    try { operation(); }
    catch (error) { console.log(error.name); }
  }
  let type;
  console.log("declared", read());
  write();
  console.log("written", read());
}
temporal();

function boolean() {
  const read = () => value;
  const set = () => { value = true; };
  const clear = () => { value = false; };
  let value;
  console.log("boolean initial", read());
  set();
  console.log("boolean true", read());
  clear();
  console.log("boolean false", read());
}
boolean();

function nullable() {
  const read = () => value === undefined ? "undefined" : value === null ? "null" : value.label;
  const set = () => { value = { label: "present" }; };
  const clear = () => { value = null; };
  let value;
  console.log("nullable initial", read());
  set();
  console.log("nullable set", read());
  clear();
  console.log("nullable clear", read());
}
nullable();

function shadows() {
  const read = () => value;
  const set = () => { value = 4; };
  let value;
  {
    const innerRead = () => value;
    const innerSet = () => { value = "inner"; };
    let value;
    console.log("shadow initial", read(), innerRead());
    innerSet();
    console.log("shadow written", read(), innerRead());
  }
  set();
  console.log("outer written", read());
}
shadows();
