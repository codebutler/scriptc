import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import { EXECUTABLE_RUNTIME_SOURCES } from "../../compiler/src/backend/native-toolchain.js";

const exec = promisify(execFile);
const sanitize = process.env["SCRIPTC_SAN"] === "1";

test("Blob and File weak keys preserve referent ownership", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "scriptc-blob-weak-"));
  try {
    const binary = join(scratch, "blob-weak");
    await exec("clang", [
      "-std=c11",
      "-O1",
      "-Wall",
      "-Wextra",
      "-Wno-deprecated-declarations",
      "-pthread",
      ...(sanitize ? ["-fsanitize=address,undefined", "-DSCR_RC_AUDIT"] : []),
      ...(process.platform === "linux" ? ["-D_GNU_SOURCE"] : []),
      ...[
        "scr_blob_weak.test.c",
        "scr_blob.c",
        "scr_async_dyn.c",
        ...EXECUTABLE_RUNTIME_SOURCES,
      ].map((name) => join(import.meta.dirname, name)),
      ...(process.platform === "linux" ? ["-lm"] : []),
      "-o",
      binary,
    ]);
    for (const threshold of ["1", "7", "256"]) {
      const result = await exec(binary, [], {
        env: {
          ...process.env,
          SCR_CYCLE_THRESHOLD: threshold,
          ASAN_OPTIONS: "detect_leaks=0:halt_on_error=1",
          UBSAN_OPTIONS: "halt_on_error=1",
        },
      });
      expect(result.stdout).toBe("Blob and File weak keys preserve identity and retire metadata\n");
      expect(result.stderr).toBe("");
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
