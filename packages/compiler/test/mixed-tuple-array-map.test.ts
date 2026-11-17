import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { compile } from "../src/index.js";
import { deserializeModule } from "../src/ir/serialize.js";
import { validateModule } from "../src/ir/validate.js";

const prelude = `interface Face { id:string; path:string }
interface StyledFace extends Face { styles:readonly string[] }
const a:Face={id:"a",path:"a.bin"};const b:StyledFace={id:"b",path:"b.bin",styles:["bold.bin"]};
type Stack=readonly [Face,StyledFace]|Face[];
`;
const cases = [
  [
    "mixed receiver",
    `function ids(stack:Stack):string{return stack.map(face=>face.id).join(",");}console.log(ids([a,b]),ids([a]));`,
    true,
  ],
  [
    "reversed arm order",
    `function ids(stack:Face[]|readonly [Face,StyledFace]):string{return stack.map(face=>face.id).join(",");}console.log(ids([a,b]),ids([a]));`,
    true,
  ],
  [
    "array baseline",
    `function ids(stack:StyledFace[]|Face[]):string{return stack.map(face=>face.id).join(",");}console.log(ids([a,b]),ids([a]));`,
    true,
  ],
  [
    "tuple baseline",
    `function ids(stack:readonly [Face,StyledFace]):string{return stack.map(face=>face.id).join(",");}console.log(ids([a,b]));`,
    true,
  ],
  [
    "live tuple read and record identity",
    `function visit(stack:Stack):boolean {const mapped=stack.map((face,index)=>{if(index===0)b.id="changed";return face;});return mapped[1]===b;}console.log(visit([a,b]));`,
    true,
  ],
  [
    "receiver and callback factories",
    `const order:string[]=[];function receiver():Stack{order.push("receiver");return [a,b];}function callback():(face:Face|StyledFace)=>string{order.push("callback");return face=>face.id;}console.log(receiver().map(callback()).join(","),order.join(","));`,
    true,
  ],
  [
    "live tuple slot replacement",
    `const replacement:StyledFace={id:"replacement",path:"replacement.bin",styles:[]};const pair:[Face,StyledFace]=[a,b];function visit(stack:Stack):string{return stack.map((face,index)=>{if(index===0)pair[1]=replacement;return face.id;}).join(",");}console.log(visit(pair));`,
    true,
  ],
  [
    "callback factory replaces source binding",
    `let stack:Stack=[a,b];function callback():(face:Face|StyledFace)=>string{stack=[a];return face=>face.id;}function visit():string{return stack.map(callback()).join(",");}console.log(visit());`,
    true,
  ],
  [
    "structural callback factory retains refusal",
    `function callback():(face:Face,index:number)=>string{return (face,index)=>face.id+index;}function visit(stack:Stack):string{return stack.map(callback()).join(",");}console.log(visit([a,b]));`,
    false,
  ],
  [
    "annotated structural inline retains refusal",
    `function visit(stack:Stack):string{return stack.map((face:Face)=>face.id).join(",");}console.log(visit([a,b]));`,
    false,
  ],
  [
    "annotated exact union inline",
    `function visit(stack:Stack):string{return stack.map((face:Face|StyledFace)=>face.id).join(",");}console.log(visit([a,b]));`,
    true,
  ],
  [
    "parenthesized exact union factory",
    `function callback():(face:Face|StyledFace)=>string{return face=>face.id;}function visit(stack:Stack):string{return stack.map((callback())).join(",");}console.log(visit([a,b]));`,
    true,
  ],
  [
    "unknown callback parameter retains refusal",
    `const callback=(face:unknown):string=>String(face);function visit(stack:Stack):string{return stack.map(callback).join(",");}console.log(visit([a,b]));`,
    false,
  ],
  [
    "array holes",
    `function visit(stack:readonly [Face,StyledFace]|(Face|undefined)[]):string {let calls=0;const result=stack.map(face=>{calls++;return face?.id??"missing";});return calls+":"+Object.keys(result).join(",");}const sparse:(Face|undefined)[]=[a,,a];console.log(visit(sparse));`,
    true,
  ],
  [
    "throw identity",
    `const reason={id:4};function visit(stack:Stack):void{try{stack.map(face=>{if(face===b)throw reason;return face.id;});}catch(error){console.log(error===reason);}}visit([a,b]);`,
    true,
  ],
  [
    "callback receiver parameter",
    `function visit(stack:Stack):boolean[]{return stack.map((face,index,original)=>original===stack);}console.log(visit([a,b]));`,
    false,
  ],
  [
    "thisArg",
    `function visit(stack:Stack):string[]{return stack.map(face=>face.id,{});}console.log(visit([a,b]));`,
    false,
  ],
  [
    "optional tuple baseline",
    `function visit(stack:readonly [Face,StyledFace?]|Face[]):number[]{return stack.map(face=>face?.id.length??0);}console.log(visit([a]));`,
    true,
  ],
  [
    "mutable tuple copy alias",
    `function visit(stack:Stack):string[]{const alias=stack as Face[];alias[1]=a;return stack.map(face=>face.id);}console.log(visit([a,b]));`,
    false,
  ],
  [
    "other methods retain boundary",
    `function visit(stack:Stack):string{return stack.filter(face=>face.id!=="").map(face=>face.id).join(",");}console.log(visit([a,b]));`,
    false,
  ],
] as const;
for (const [name, body, supported] of cases)
  test(`mixed tuple/array map: ${name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "scriptc-mixed-map-"));
    try {
      const entry = join(dir, "main.ts"),
        out = join(dir, "main.ir.json");
      writeFileSync(entry, prelude + body);
      const result = await compile(entry, { outputKind: "ir", outDir: dir, outPath: out });
      expect(result.ok, JSON.stringify(result)).toBe(supported);
      if (result.ok) {
        const module = deserializeModule(readFileSync(out, "utf8"));
        expect(validateModule(module)).toEqual([]);
        if (name === "mixed receiver") {
          const body = JSON.stringify(module.functions);
          expect(body).toContain("unionNarrow");
          expect(body).toContain("%tuple.map");
          expect(body).not.toContain("%union.arr");
        }
      } else
        expect(result.diagnostics.some((d) => d.code === "SC1090" || d.code === "SC2020")).toBe(
          true,
        );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
