// The borrowed native reader keeps the same part-dependent microtask turns
// as the ordinary reader, including empty and multipart Blob/File sources.
async function turns(label: string, value: Blob): Promise<void> {
  let tick = 0;
  let stop = false;
  const spin = (): void => {
    if (stop || tick >= 100) return;
    tick++;
    queueMicrotask(spin);
  };
  queueMicrotask(spin);
  await Blob.prototype.arrayBuffer.call(value);
  const seen = tick;
  stop = true;
  console.log(label, seen);
  await new Promise<void>((resolve) => setTimeout(resolve, 1));
}
async function main(): Promise<void> {
  await turns("empty", new Blob([]));
  await turns("one", new Blob(["a"]));
  await turns("many", new Blob(["a", "bc", "d"]));
  await turns("file", new File(["a", "b"], "f"));
  const order: string[] = [];
  const many = new Blob(["a", "b", "c"]);
  const one = new Blob(["z"]);
  await Promise.all([
    Blob.prototype.arrayBuffer.call(many).then(() => order.push("many")),
    one.arrayBuffer().then(() => order.push("one")),
    Promise.resolve().then(() => order.push("plain")),
  ]);
  console.log(order.join(","));
}
void main();
