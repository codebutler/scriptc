import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { fallbackDtsPath, fallbackModulePath } from "../dts-paths.js";
import { Ts7Host } from "../ts7/program-host.js";
import { Ts7Api } from "../ts7/rpc-api.js";
import { ModuleKind, ModuleResolutionKind } from "../ts7/enums.js";
import { hasWorkerBufferTransfers } from "./buffers.js";

test("worker detachment is known before lowering and leaves no-transfer calls unchanged", () => {
  const directory = mkdtempSync(join(tmpdir(), "scriptc-worker-buffer-fact-"));
  const cases: [string, string, boolean][] = [
    ["plain.ts", "port.postMessage(value);", false],
    ["empty.ts", "port.postMessage(value, []);", false],
    ["null.ts", "port.postMessage(value, null);", false],
    ["undefined.ts", "port.postMessage(value, undefined);", false],
    ["transfer.ts", "port.postMessage(value, [buffer]);", true],
    ["transfer.js", "port.postMessage(value, [buffer]);", true],
    ["options.ts", "port.postMessage(value, { transfer: [buffer] });", true],
    ["alias.ts", "const send = port.postMessage;", true],
    ["destructure.ts", "const { postMessage: send } = port;", true],
    ["element.js", "port['postMessage'](value, list);", true],
    [
      "dynamic.ts",
      "import { parentPort } from 'node:worker_threads'; function send(port: any, key: string, value: unknown, list: unknown[]) { port[key](value, list); }",
      true,
    ],
    [
      "dynamic-alias.ts",
      "const w = require('node:worker_threads'); function method(port: any, key: string) { return port[key]; }",
      true,
    ],
    [
      "dictionary.ts",
      "function method(dict: Record<string, any>, key: string) { return dict[key]; }",
      false,
    ],
    [
      "shadow-require.ts",
      "function require(name: string) { return {}; } const w = require('node:worker_threads'); function method(port: any, key: string) { return port[key]; }",
      false,
    ],
    [
      "created-require.ts",
      "import { createRequire as create } from 'node:module'; const r = create(import.meta.url); const id = 'node:worker_threads'; const w = r(id); function method(port: any, key: string) { return port[key]; }",
      true,
    ],
    [
      "builtin-module.ts",
      "const w = process.getBuiltinModule('node:worker_threads'); function method(port: any, key: string) { return port[key]; }",
      true,
    ],
    [
      "global-channel.ts",
      "const channel = new MessageChannel(); function method(port: any, key: string) { return port[key]; }",
      true,
    ],
    [
      "dynamic-import.ts",
      "const w = await import('node:worker_threads'); function method(port: any, key: string) { return port[key]; }",
      true,
    ],
    [
      "constant-module.ts",
      "const id = 'node:' + 'worker_threads'; const w = require(id); function method(port: any, key: string) { return port[key]; }",
      true,
    ],
    [
      "other-require.ts",
      "const fs = require('node:fs'); function method(dict: Record<string, any>, key: string) { return dict[key]; }",
      false,
    ],
    ["index.ts", "function read(bytes: Uint8Array, index: number) { return bytes[index]; }", false],
    ["spread.ts", "port.postMessage(...args);", true],
    [
      "worker.ts",
      "import { Worker } from 'node:worker_threads'; new Worker('x', { workerData: 1 });",
      false,
    ],
    [
      "worker-transfer.ts",
      "import { Worker } from 'node:worker_threads'; new Worker('x', { transferList: [buffer] });",
      true,
    ],
    [
      "worker-empty.ts",
      "import { Worker } from 'node:worker_threads'; new Worker('x', { transferList: [] });",
      false,
    ],
    [
      "worker-alias.ts",
      "import { Worker as Start } from 'node:worker_threads'; new Start('x', options);",
      true,
    ],
    [
      "local.ts",
      "class Worker { constructor(a, b) {} } new Worker('x', { transferList: [buffer] });",
      false,
    ],
  ];
  for (const [file, source] of cases)
    writeFileSync(join(directory, file), source + "\nexport {};\n");
  const host = new Ts7Host((options) => new Ts7Api(options), { cwd: directory });
  const program = host.createProgram(
    [
      ...cases.map(([file]) => join(directory, file)),
      fallbackDtsPath(),
      fallbackModulePath("node:worker_threads")!,
      fallbackModulePath("node:module")!,
      fallbackModulePath("node:process")!,
    ],
    {
      noLib: true,
      types: [],
      allowJs: true,
      module: ModuleKind.ESNext,
      moduleResolution: ModuleResolutionKind.Bundler,
    },
  );
  try {
    for (const [file, , expected] of cases)
      expect(
        hasWorkerBufferTransfers(program, [program.getSourceFile(join(directory, file))!]),
        file,
      ).toBe(expected);
  } finally {
    program.dispose();
    host.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
