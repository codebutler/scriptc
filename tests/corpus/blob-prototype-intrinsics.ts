// Prototype identity is distinct from the Blob internal-slot brand. The
// borrowed reader must not look up a similarly named receiver property.
import { Blob as BufferBlob, File as BufferFile } from "node:buffer";

async function main(): Promise<void> {
  const blob = new Blob([new Uint8Array([1, 2]), "x"], { type: "Text/Plain" });
  const file = new File(["file"], "proof.bin", { lastModified: 7 });
  console.log("blob", Object.getPrototypeOf(blob) === Blob.prototype);
  console.log("file", Object.getPrototypeOf(file) === File.prototype);
  console.log("base", Object.getPrototypeOf(File.prototype) === Blob.prototype);
  console.log("object", Object.getPrototypeOf(Blob.prototype) === Object.prototype);
  console.log("aliases", BufferBlob.prototype === Blob.prototype, BufferFile.prototype === File.prototype);
  console.log("global", globalThis.Blob.prototype === Blob.prototype);
  console.log("distinct", Object.getPrototypeOf(file) !== Blob.prototype, file instanceof Blob);
  console.log("method", File.prototype.arrayBuffer === Blob.prototype.arrayBuffer);

  const read = Blob.prototype.arrayBuffer;
  const a = await read.call(blob);
  const b = await Blob.prototype.arrayBuffer.call(blob);
  console.log("bytes", a instanceof ArrayBuffer, a !== b, [...new Uint8Array(a)].join(","));
  new Uint8Array(a)[0] = 99;
  console.log("copy", new Uint8Array(b)[0], new Uint8Array(await read.call(blob))[0]);
  console.log("file bytes", new Uint8Array(await read.call(file)).join(","));

  let propertyReads = 0;
  const fake = { get arrayBuffer(): () => Promise<ArrayBuffer> {
    propertyReads++;
    throw new Error("must not read the receiver's property");
  } };
  for (const value of [fake, Object.create(Blob.prototype), null, 3]) {
    let sync = true;
    const rejected = Blob.prototype.arrayBuffer.call(value);
    console.log("promise", rejected instanceof Promise);
    const settled = rejected.then(
      () => "unexpected",
      (error: unknown) => `${error instanceof TypeError}:${sync}`,
    );
    sync = false;
    console.log("brand", await settled);
  }
  console.log("receiver properties", propertyReads);

  const events: string[] = [];
  function receiver(): Blob { events.push("receiver"); return blob; }
  console.log("evaluated", new Uint8Array(await read.call(receiver())).length, events.join(","));
}
void main();
