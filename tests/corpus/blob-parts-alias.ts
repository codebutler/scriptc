const bytes = new Uint8Array([65, 66, 67, 68]);
const view = new Uint8Array(bytes.buffer, 1, 2);
const parts: BlobPart[] = ["start:", new Blob(["x"]), view, bytes.buffer];
const blob = new Blob(parts);
const file = new File(parts, "parts.bin", { lastModified: 7 });
bytes.fill(90);
console.log(await blob.text(), await file.text(), file.name, file.lastModified);
console.log(blob.size, file.size, bytes.byteLength, view.byteLength);
