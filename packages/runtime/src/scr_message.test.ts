import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import { EXECUTABLE_RUNTIME_SOURCES } from "../../compiler/src/backend/native-toolchain.js";

const exec = promisify(execFile);

test.skipIf(process.platform === "win32").each([false, true])(
  "message data outlives its sender and decodes into a separate runtime heap (mutable buffers: %s)",
  async (mutableBuffers) => {
    const dir = await mkdtemp(join(tmpdir(), "scriptc-message-"));
    try {
      const bin = join(dir, "messages");
      await exec("clang", [
        "-std=c11",
        "-O1",
        "-pthread",
        "-DSCR_WORKERS",
        "-DSCR_RC_AUDIT",
        ...(mutableBuffers ? ["-DSCR_JS_OBJECT_MODEL"] : []),
        "-fsanitize=address,undefined",
        "-Wno-deprecated-declarations",
        ...(process.platform === "linux" ? ["-D_GNU_SOURCE"] : []),
        join(import.meta.dirname, "scr_message.test.c"),
        join(import.meta.dirname, "scr_message.c"),
        ...(mutableBuffers
          ? ["scr_js_buffers.c", "scr_js_object.c", "scr_js_value.c"].map((name) =>
              join(import.meta.dirname, name),
            )
          : []),
        ...EXECUTABLE_RUNTIME_SOURCES.map((name) => join(import.meta.dirname, name)),
        ...(process.platform === "linux" ? ["-lm"] : []),
        "-o",
        bin,
      ]);
      const result = await exec(bin, [], {
        env: { ...process.env, UBSAN_OPTIONS: "halt_on_error=1" },
      });
      expect(result.stdout).toBe(
        (mutableBuffers
          ? "ArrayBuffer allocations move across heaps and release on cancellation\n"
          : "") +
          "message graphs preserve identity, sparse values, byte aliases and getter order\n" +
          "native handles cross threads through their transfer hooks\n",
      );
      expect(result.stderr).toBe("");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
