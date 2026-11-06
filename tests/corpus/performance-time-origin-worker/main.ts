import { Worker } from "node:worker_threads";
const origin = performance.timeOrigin;
const worker = new Worker(new URL("./worker.ts", import.meta.url));
const received = await new Promise<number>((resolve, reject) => {
  worker.once("message", (value: number) => resolve(value));
  worker.once("error", (error: Error) => reject(error));
});
console.log(received === origin, performance.timeOrigin === origin);
await worker.terminate();
