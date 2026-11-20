async function check() {
  let last: Promise<void> | null = null;
  const log: string[] = [];
  function schedule(label: string) {
    const previous = last ?? Promise.resolve();
    const settled = previous
      .then(() => {
        log.push(label);
      })
      .finally(() => {
        if (last === settled) {
          log.push("last");
          last = null;
        }
      });
    last = settled;
    return settled;
  }
  const one = schedule("a");
  const two = schedule("b");
  await one;
  await two;
  console.log(log.join(","), last === null);
}
async function early() {
  const p: Promise<number> = new Promise<number>((resolve) => {
    try {
      console.log(p === p);
    } catch (e) {
      console.log(e instanceof ReferenceError, e instanceof Error ? e.message : "wrong error");
    }
    resolve(12);
  });
  console.log(await p);
}
await check();
await early();
export {};
