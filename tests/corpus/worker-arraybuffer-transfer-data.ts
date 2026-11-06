import { Worker, MessageChannel, receiveMessageOnPort, isMainThread, parentPort, workerData } from "node:worker_threads";

function check(value: boolean, message: string): void { if (!value) throw new Error(message); }

if (isMainThread) {
  const buffer = new ArrayBuffer(3);
  new Uint8Array(buffer).set([40, 2, 3]);
  const channel = new MessageChannel();
  const worker = new Worker(new URL(import.meta.url), {
    workerData: { buffer, port: channel.port1 },
    transferList: [buffer, channel.port1],
  });
  check(buffer.byteLength === 0, "workerData source stayed attached");
  channel.port2.once("message", (value: number) => {
    check(value === 42, "mixed transfer lost port or bytes");
    console.log("workerData transfers buffer and port together");
    channel.port2.close();
  });
  worker.on("exit", (code: number) => console.log("exit", code));

  const local = new MessageChannel();
  const spare = new MessageChannel();
  const bytes = new ArrayBuffer(1);
  let duplicate = false;
  try { local.port1.postMessage(0, [bytes, spare.port1, spare.port1]); }
  catch (error) { duplicate = (error as Error).name === "DataCloneError"; }
  check(duplicate && bytes.byteLength === 1, "duplicate port detached an earlier buffer");
  spare.port1.postMessage(9);
  check(receiveMessageOnPort(spare.port2)!.message === 9, "duplicate list detached port");
  local.port1.postMessage({ bytes }, { transfer: [bytes] });
  check(bytes.byteLength === 0 && receiveMessageOnPort(local.port2)!.message.bytes.byteLength === 1,
    "options transfer did not move buffer");
  console.log("mixed duplicate validation is atomic and options form transfers");
  local.port1.close(); local.port2.close(); spare.port1.close(); spare.port2.close();
} else {
  const bytes = new Uint8Array(workerData.buffer);
  workerData.port.postMessage(bytes[0]! + bytes[1]!);
  workerData.port.close();
  parentPort!.close();
}
