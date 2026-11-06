import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import { compile } from "../../packages/compiler/src/index.js";

const exec = promisify(execFile);

test("worker transfers refuse resizable storage and invalid late-detached startup views", async () => {
  const outDir = mkdtempSync(join(tmpdir(), "scriptc-worker-transfer-refusals-"));
  const entry = join(outDir, "main.cjs");
  writeFileSync(
    entry,
    `
const { Worker, MessageChannel, isMainThread } = require('node:worker_threads');
if (!isMainThread) throw new Error('refused worker must never start');
const channel = new MessageChannel();
const resizable = new ArrayBuffer(4, { maxByteLength: 8 });
try { channel.port1.postMessage(resizable, [resizable]); }
catch (error) { console.log(error.message); }
console.log('resizable remains attached', resizable.byteLength);
channel.port1.close(); channel.port2.close();
const buffer = new ArrayBuffer(4);
const view = new Uint8Array(buffer);
try {
  new Worker(__filename, {
    workerData: { view, get value() { buffer.transfer(); return 1; } },
    transferList: [buffer],
  });
} catch (error) { console.log(error.message); }
console.log('getter already detached', buffer.byteLength);
`,
  );
  const result = await compile(entry, {
    backend: "llvm",
    sanitize: process.env["SCRIPTC_SAN"] === "1",
    outDir,
    outPath: join(outDir, "program"),
  });
  expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
  if (!result.ok) return;
  const { stdout, stderr } = await exec(result.binaryPath, [], {
    encoding: "utf8",
    timeout: 15_000,
  });
  expect(stdout).toBe(
    "Worker transfer requires fixed owned ArrayBuffer storage and the mutable-buffers registry\n" +
      "resizable remains attached 4\n" +
      "Worker constructor data with a view detached during serialization is not supported yet\n" +
      "getter already detached 0\n",
  );
  expect(stderr).toBe("");
});
