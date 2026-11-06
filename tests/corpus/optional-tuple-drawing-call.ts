type Path = { kind: 'path'; points: number[] };
interface Backend { clip(path: Path, subtract: boolean, key?: string): string; }
type Command = { op: 'clip'; args: Parameters<Backend['clip']> };
const backend: Backend = { clip(path, subtract, key) {
  path.points[0] = (path.points[0] ?? 0) + 10;
  return `${path.kind}:${path.points.length}:${subtract}:${key ?? 'none'}`;
} };
function replay(c: Command) { return backend.clip(...c.args); }
const recording: Backend = { clip: (path, subtract, key) => replay({ op: 'clip', args: [path, subtract, key] }) };
const path: Path = {kind:'path', points:[1,2]};
console.log(recording.clip(path, false), path.points[0]);
console.log(recording.clip(path, true, 'resource'), path.points[0]);
console.log(replay({op:'clip',args:[path,false]}), path.points[0]);
console.log(replay({op:'clip',args:[path,true,undefined]}), path.points[0]);
let reads = 0;
function argumentsOnce(): Parameters<Backend['clip']> { reads++; return [path, false]; }
console.log(backend.clip(...argumentsOnce()), reads, path.points[0]);

const order: string[] = [];
const receiver = {
  prefix: "owner",
  get clip(): Backend["clip"] {
    order.push("get");
    return function(this: { prefix: string }, path: Path, subtract: boolean, key?: string): string {
      order.push("call");
      return `${this.prefix}:${path.kind}:${subtract}:${key ?? "none"}`;
    };
  },
};
function target() { order.push("target"); return receiver; }
function parameters(): Parameters<Backend["clip"]> { order.push("args"); return [path, true]; }
console.log(target().clip(...parameters()), order.join(","));
interface Overloaded {
  value(n: number, suffix?: string): number;
  value(n: string, suffix?: string): string;
}
function value(n: number, suffix?: string): number;
function value(n: string, suffix?: string): string;
function value(n: number | string, suffix?: string): number | string {
  return typeof n === "number" ? n + (suffix?.length ?? 0) : n + (suffix ?? "");
}
const overloaded: Overloaded = { value };
const numberArgs: [number, string?] = [20, "ab"];
const stringArgs: [string, string?] = ["x"];
console.log(overloaded.value(...numberArgs) + 1, overloaded.value(...stringArgs).toUpperCase());
