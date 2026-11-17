import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";

test("narrowed class keys reject incompatible stored arms before collection mutation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-class-key-policy-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(
      entry,
      `class Command { run():number{return 7;} }
class Widget { paint():number{return 9;} }
type Part=Command|Widget|string|null;
function claimsCommand(value:Part|undefined):value is Command{return true;}
function check(parts:readonly Part[]):void{
 const set=new Set<Command>();const map=new Map<Command,number>();
 const part=parts[0];
 if(claimsCommand(part)){
  const later=()=>part.run();
  try {set.add(part);console.log("set valid",set.has(part),later());}
  catch(error){console.log("set refused",error instanceof TypeError,set.size);}
  try {map.set(part,1);console.log("map valid",map.get(part),later());}
  catch(error){console.log("map refused",error instanceof TypeError,map.size);}
 }
}
check([new Command()]);check([new Widget()]);check(["bad"]);check([null]);check([]);export {};`,
    );
    const result = await compile(entry, {
      outDir: dir,
      outPath: join(dir, "program"),
      sanitize: process.env["SCRIPTC_SAN"] === "1",
    });
    expect(result.ok, result.ok ? "" : JSON.stringify(result.diagnostics)).toBe(true);
    if (!result.ok) return;
    const run = spawnSync(result.binaryPath, [], { encoding: "utf8", timeout: 30000 });
    expect(run.error).toBeUndefined();
    expect({
      status: run.status,
      signal: run.signal,
      stdout: run.stdout,
      stderr: run.stderr,
    }).toEqual({
      status: 0,
      signal: null,
      stderr: "",
      stdout:
        "set valid true 7\nmap valid 1 7\n" + "set refused true 0\nmap refused true 0\n".repeat(4),
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
