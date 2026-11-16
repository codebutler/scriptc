function generate(decorator) {
  let handlers = { result() { return "text"; } };
  if (decorator) handlers = decorator(handlers);
  const alias = handlers;
  return alias.result();
}
const result = generate(() => ({result(){return [1,2,3];}}));
console.log("result", Array.isArray(result), JSON.stringify(result));
function returned(flag) {
  const value = {kind:false};
  if(flag) value.kind = "node";
  return value.kind;
}
function forward() { return returned(true); }
function aliasReturn() {
  const value = {kind:false}; value.kind = "node";
  const alias = value.kind;
  return alias;
}
function destructureReturn() {
  const value = {kind:false}; value.kind = "node";
  const {kind} = value;
  return kind;
}
console.log("returns",forward(),aliasReturn(),destructureReturn());
function first(n) { if(n) return second(n-1); return returned(true); }
function second(n) { return first(n); }
console.log("recursive",second(3),first(2));
let holder;
const events=[];
const sentinel={};
function invoke(replace) {
  let value={run(arg){return "old"+arg;}};
  value=replace(value);
  const alias=value;
  function argument(){events.push("arg");return 7;}
  return alias.run(argument());
}
console.log("receiver",JSON.stringify(invoke(() => ({
  get run(){events.push("get");return function(arg){events.push("call");return [this===holder,arg];};},
  get marker(){return true;}
}))));
// A captured object verifies that ordinary dynamic calls retain this.
const received=invoke(() => (holder={get run(){events.push("get2");return function(arg){return [this===holder,arg];};}}));
console.log("captured",JSON.stringify(received),events.join(","));
try { invoke(() => ({get run(){throw sentinel;}})); }
catch(error){console.log("throw",error===sentinel);}
console.log("recovery",generate(null));

class Replacement { result(){return ["class",42];} }
console.log("class",JSON.stringify(generate(()=>new Replacement())));
async function delayed(){await Promise.resolve();const value=generate(()=>({result(){return ["later"];}}));return value;}
console.log("async",JSON.stringify(await delayed()));
