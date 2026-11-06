import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import {
  EXECUTABLE_RUNTIME_SOURCES,
  LIB_RUNTIME_SOURCES,
} from "../../compiler/src/backend/native/runtime-inputs.js";

const exec = promisify(execFile);
const sanitize = process.env["SCRIPTC_SAN"] === "1";

test.skipIf(process.platform === "win32").each([
  { name: "ordinary", defines: [], failClock: false },
  { name: "worker", defines: ["SCR_WORKERS"], failClock: false },
  { name: "thread library", defines: ["SCR_LIB", "SCR_THREAD_INSTANCES"], failClock: false },
  { name: "failed epoch read", defines: ["SCR_TEST_CLOCK_FAILURE"], failClock: true },
])("epoch origin: $name", async ({ defines, failClock }) => {
  const scratch = await mkdtemp(join(tmpdir(), "scriptc-perf-origin-"));
  try {
    const binary = join(scratch, "origin");
    const sources = defines.includes("SCR_LIB") ? LIB_RUNTIME_SOURCES : EXECUTABLE_RUNTIME_SOURCES;
    await exec("clang", [
      "-std=c11",
      "-O1",
      "-pthread",
      "-DSCR_PERF_ORIGIN",
      "-Wno-deprecated-declarations",
      "-ffunction-sections",
      "-fdata-sections",
      ...(process.platform === "darwin" ? ["-Wl,-dead_strip"] : ["-Wl,--gc-sections"]),
      ...defines.map((name) => `-D${name}`),
      ...(sanitize ? ["-fsanitize=address,undefined", "-DSCR_RC_AUDIT"] : []),
      ...(process.platform === "linux" ? ["-D_GNU_SOURCE"] : []),
      ...["scr_perf_origin.test.c", ...sources].map((name) => join(import.meta.dirname, name)),
      ...(process.platform === "linux" ? ["-lm"] : []),
      "-o",
      binary,
    ]);
    if (failClock) {
      try {
        await exec(binary, [], { timeout: 30000 });
        expect.fail("the constructor should refuse a failed epoch-clock read");
      } catch (error) {
        expect(error).toMatchObject({
          signal: "SIGABRT",
          stderr: expect.stringContaining("performance.timeOrigin: CLOCK_REALTIME read failed"),
        });
      }
      return;
    }
    const result = await exec(binary, [], {
      timeout: 30000,
      env: {
        ...process.env,
        ASAN_OPTIONS: "detect_leaks=0:halt_on_error=1",
        UBSAN_OPTIONS: "halt_on_error=1",
      },
    });
    expect(result.stdout).toBe(
      "epoch origin is immutable and shared by monotonic clocks across threads\n",
    );
    expect(result.stderr).toBe("");
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
