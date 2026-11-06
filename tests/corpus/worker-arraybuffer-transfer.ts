import { Worker, isMainThread, parentPort } from "node:worker_threads";

function check(value: boolean, message: string): void { if (!value) throw new Error(message); }
type Payload = { buffer: ArrayBuffer; bytes: Uint8Array; view: DataView; alias: Uint8Array };
type Reply = { kind: "value"; value: Payload } | { kind: "detached"; length: number };

// This function is lowered before any transfer site. The call can detach
// the view during the loop, so its bound cannot be cached across calls.
function walkUntilDetached(bytes: Uint8Array, send: () => void): number {
  let visited = 0;
  for (let i = 0; i < bytes.length; i++) {
    visited++;
    send();
  }
  return visited;
}

if (isMainThread) {
  const worker = new Worker(new URL(import.meta.url));
  const buffer = new ArrayBuffer(12);
  const bytes = new Uint8Array(buffer, 2, 4);
  const view = new DataView(buffer, 1, 7);
  bytes.set([1, 2, 3, 4]);
  worker.on("message", (reply: Reply) => {
    if (reply.kind === "value") {
      const value = reply.value;
      check(value.bytes === value.alias, "lost repeated view identity");
      check(value.bytes.buffer === value.buffer && value.view.buffer === value.buffer, "lost backing identity");
      check(value.bytes.byteOffset === 2 && value.view.byteOffset === 1, "lost view offsets");
      check(value.bytes[0] === 42 && value.bytes[1] === 2, "wrong moved bytes");
      console.log("round trip preserves bytes, views and aliases");
    } else {
      check(reply.length === 0, "worker sender was not detached");
      console.log("both senders detach immediately");
    }
  });
  worker.on("exit", (code: number) => console.log("exit", code));
  const visited = walkUntilDetached(bytes, () => worker.postMessage({ buffer, bytes, view, alias: bytes }, { transfer: [buffer] }));
  check(visited === 1, "typed loop cached its bound across transfer");
  check(buffer.byteLength === 0 && bytes.length === 0 && bytes.byteLength === 0 && bytes.byteOffset === 0,
    "main sender was not detached");
  let dataViewFailed = false;
  try { void view.byteLength; } catch { dataViewFailed = true; }
  check(dataViewFailed, "detached DataView getter did not throw");
  let iterations = 0;
  for (let i = 0; i < bytes.length; i++) iterations++;
  check(iterations === 0, "typed loop reused the pre-transfer length");
} else {
  parentPort!.once("message", (value: Payload) => {
    value.bytes[0] = 42;
    parentPort!.postMessage({ kind: "value", value }, [value.buffer]);
    parentPort!.postMessage({ kind: "detached", length: value.bytes.length });
    parentPort!.close();
  });
}
