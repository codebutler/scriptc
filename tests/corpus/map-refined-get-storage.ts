export {};
interface Named {
  label: string;
}
interface Count {
  count: number;
}
declare global {
  interface Map<K, V> {
    get(this: Map<"name" | "count", Named | Count>, key: "name"): Named | undefined;
  }
}
const table = new Map<"name" | "count", Named | Count>();
const named = { label: "before" };
table.set("name", named);
table.set("count", { count: 3 });
const got = table.get("name");
console.log(got === named, got?.label);
named.label = "updated";
console.log(got?.label, table.delete("name"), table.get("name") === undefined);
