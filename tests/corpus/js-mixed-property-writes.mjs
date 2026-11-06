function walker(fieldTypes) {
  const value = { name: "children", type: false, nullable: false };
  for (const field of fieldTypes) {
    if (field === null) value.nullable = true;
    else if (typeof field === "string") value.type = "node";
    else if (Array.isArray(field)) value.type = "list";
  }
  return value;
}
function show(fields) {
  const result = walker(fields);
  console.log(result.name, result.type, result.nullable);
}
show([]);
show([null]);
show(["Node"]);
show([["Node"]]);
show(["Node", null]);

const changing = { state: 0, label: "initial" };
const alias = changing;
changing.state = "ready";
changing.label = false;
console.log(alias === changing, alias.state, alias.label);
changing.state = 2;
console.log(alias.state);
