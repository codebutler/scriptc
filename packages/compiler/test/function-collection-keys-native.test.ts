import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
test("function collection keys refuse unsupported identities before mutation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scriptc-function-key-policy-"));
  try {
    const entry = join(dir, "main.ts");
    writeFileSync(
      entry,
      `type Sink=(value:number)=>void;
interface Options { readonly command:(value:number)=>number; readonly event?:Sink; }
class Controller {
 readonly events=new Set<Sink>();
 command(value:number):number{return value;}
 add(options:Options):void {if(options.event)this.events.add(options.event);}
}
const c=new Controller();let calls=0;
const sink:Sink=()=>{calls++;};
function attempt(value:unknown):void{
 try{c.add({command:n=>n,event:value as Sink});console.log("unexpected");}
 catch(error){console.log("refused",error instanceof Error && "code" in error && error.code==="SC2020",error instanceof TypeError,c.events.size);}
}
attempt(new Proxy(sink,{}));
class Constructor {constructor(){calls++;}}
attempt(Constructor);
attempt(42);
console.log("calls",calls);
c.add({command:n=>n,event:sink});console.log("recovery",c.events.has(sink),c.events.delete(sink),c.events.size);
export {};
`,
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
    expect(
      {
        status: run.status,
        signal: run.signal,
        stdout: run.stdout,
        stderr: run.stderr,
      },
      JSON.stringify({ stdout: run.stdout, stderr: run.stderr }),
    ).toEqual({
      status: 0,
      signal: null,
      stderr: "",
      stdout:
        "refused true false 0\nrefused true false 0\nrefused false true 0\ncalls 0\nrecovery true true 0\n",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
