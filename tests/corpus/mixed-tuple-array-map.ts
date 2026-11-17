interface Face { id: string; payload: { value: number } }
interface StyledFace extends Face { style: string }
type Stack = readonly [Face, StyledFace] | Face[];
const first: Face = { id: "first", payload: { value: 1 } };
const second: StyledFace = { id: "second", payload: { value: 2 }, style: "bold" };
const replacement: StyledFace = { id: "replacement", payload: { value: 3 }, style: "plain" };

function ids(stack: Stack): string { return stack.map(face => face.id).join(","); }
function refs(stack: Stack): void {
 const values = stack.map(face => face);
 console.log("identity", values[0] === first, values[1] === second);
}
const tuple: [Face, StyledFace] = [first, second];
const array: Face[] = [first, first, first];
console.log("arms", ids(tuple), ids(array));
refs(tuple); refs(array);

function mutate(stack: Stack): string {
 return stack.map((face, index) => {
  if (index === 0) tuple[1] = replacement;
  face.payload.value += 10;
  return face.id;
 }).join(",");
}
console.log("live", mutate(tuple), tuple[1] === replacement, first.payload.value, replacement.payload.value);

const order: string[] = [];
let current: Stack = tuple;
function receiver(): Stack { order.push("receiver"); return current; }
function callback(): (face: Face | StyledFace, index: number) => string {
 order.push("callback"); current = array;
 return (face, index) => { order.push("visit" + index); return face.id; };
}
console.log("order", receiver().map(callback()).join(","), order.join(","), current === array);

function sparseMap(stack: readonly [Face, StyledFace] | (Face | undefined)[]): void {
 let calls = 0;
 const values = stack.map(face => { calls++; return face?.id ?? "undefined"; });
 console.log("sparse", values.length, calls, Object.keys(values).join(","), values.join("/"));
}
const sparse: (Face | undefined)[] = [first, , undefined, first];
sparseMap(sparse); sparseMap(tuple);

const reason = { token: 42 };
function throws(stack: Stack): void {
 let calls = 0;
 try { stack.map(face => { calls++; if (face.id === "replacement") throw reason; return face; }); }
 catch (error) { console.log("throw", error === reason, calls); }
 console.log("recover", stack.map(face => face.id).join(","));
}
throws(tuple);

let selected: Face = first;
const roles = { fixed: tuple, get dynamic(): Face[] { return [selected]; } };
async function afterAwait(): Promise<void> {
 await Promise.resolve(); selected = { id: "selected", payload: { value: 9 } };
 console.log("roles", Object.entries(roles).map(([role, stack]) => role + ":" + stack.map(face => face.id).join(",")).join(";"));
}
void afterAwait();
