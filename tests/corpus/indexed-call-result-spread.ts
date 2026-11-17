type Role = "body" | "mono";
type Stacks = Readonly<Partial<Record<Role, readonly string[]>>>;
const events: string[] = [];
const sentinel = new Error("map stopped");
function replace(stacks: Stacks, input: Readonly<Record<string, readonly string[]>>, fail = false): Stacks {
  return {
    ...stacks,
    ...Object.fromEntries(Object.entries(input).map(([role, stack]) => {
      events.push(role);
      if (fail) throw sentinel;
      return [role, [...new Set([...stack, "fallback"])]];
    })),
  };
}
const seed: Stacks = {body:["old"],mono:["old mono"]};
const first = replace(seed, {mono:["new", "new"],extra:["other"]});
console.log("first", JSON.stringify(first), Object.keys(first).join(","));
console.log("seed", JSON.stringify(seed), events.join(","));
const second = replace({}, {mono:["second"],body:["body"],"2":["two"],"1":["one"]});
console.log("second", JSON.stringify(second), Object.keys(second).join(","));
const special = Object.fromEntries([["__proto__",["own"]],["body",["ok"]]]);
console.log("special", JSON.stringify(replace({},special)));
try { replace(seed,{body:["throw"]},true); }
catch (error) { console.log("same",error===sentinel); }
console.log("events",events.join(","));
console.log("recovery",JSON.stringify(replace({}, {body:["ready"]})));

const changing: { body: readonly string[] } = {body:["before"]};
function later(): Readonly<Record<string,readonly string[]>> {
  events.push("later"); changing.body=["mutated"]; return {mono:["after"]};
}
const ordered: Stacks={...changing,...later()};
console.log("order",JSON.stringify(ordered),changing.body.join(","),events.at(-1));

console.log("seed identity",first.body===seed.body);
const alias=["held"];
const indexed:Readonly<Record<string,readonly string[]>>={body:alias};
const shallow:Stacks={...indexed};
console.log("indexed identity",shallow.body===alias);
alias.push("visible");console.log("indexed mutation",shallow.body?.join(","));
