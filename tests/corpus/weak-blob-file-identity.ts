const blob = new Blob(["bytes"]);
const file = new File(["bytes"], "file.bin", { lastModified: 7 });
const alias: Blob = file;
const metadata = new WeakMap<Blob, string>([[blob, "blob"], [file, "file"]]);
const seen = new WeakSet<Blob>([blob, file]);
console.log("aliases", metadata.get(alias), seen.has(alias), alias === file);
console.log("distinct", metadata.has(file.slice()), metadata.has(new Blob([file])), seen.has(new File([file], "file.bin")));
metadata.set(alias, "replacement");
console.log("replace", metadata.get(file), metadata.get(blob));
console.log("delete", metadata.delete(alias), metadata.delete(file), seen.delete(alias), seen.has(file));
metadata.set(file, "again");
console.log("restore", metadata.get(alias));

// Keep registration targets/tokens live; the existing registry subset does
// not promise delivery of cleanup callbacks.
let callbacks = 0;
const registry = new FinalizationRegistry<string>(() => { callbacks++; });
registry.register(blob, "blob", file);
registry.register(file, "file", blob);
console.log("registry", registry.unregister(alias), registry.unregister(file), registry.unregister(blob), registry.unregister(new Blob([])), callbacks);

const ephemeral = new WeakMap<Blob, number>();
const ephemeralSet = new WeakSet<Blob>();
const kept: Blob[] = [];
let stale = 0;
function fill(round: number): void {
  for (let i = 0; i < 128; i++) {
    const key: Blob = i % 2 === 0 ? new Blob(["x"]) : new File(["x"], "x");
    if (ephemeral.has(key) || ephemeralSet.has(key)) stale++;
    ephemeral.set(key, round * 128 + i);
    ephemeralSet.add(key);
    if (i === 0) kept.push(key);
  }
}
for (let round = 0; round < 16; round++) fill(round);
console.log("churn", stale, kept.every(key => ephemeral.has(key) && ephemeralSet.has(key)), kept.length);
