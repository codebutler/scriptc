async function main() {
  const error = new Error("rejected");
  let finish: (n: number) => void = () => {};
  const delayed = new Promise<number>(resolve => { finish = resolve; });
  const failed = Promise.reject<number>(error);
  const jobs = new Set<Promise<number>>([delayed, Promise.resolve(8), failed]);
  jobs.add(delayed);
  let reads = 0;
  function input(): Set<Promise<number>> { reads++; return jobs; }
  const pending = Promise.allSettled(input());
  jobs.clear();
  jobs.add(Promise.resolve(99));
  finish(4);
  const results = await pending;
  console.log("snapshot", reads, results.length, jobs.size);
  for (const result of results) {
    if (result.status === "fulfilled") console.log("value", result.value);
    else console.log("reason", result.reason === error);
  }
  const empty = await Promise.allSettled(new Set<Promise<number>>());
  console.log("empty", empty.length);
  console.log("any", await Promise.any(new Set([Promise.reject<number>(error), Promise.resolve(7)])));
  try { await Promise.any(new Set<Promise<number>>()); }
  catch (reason) { console.log("empty any", String(reason)); }
  const voids = await Promise.allSettled(new Set([Promise.resolve()]));
  for (const result of voids) if (result.status === "fulfilled") console.log("void", typeof result.value);
  const unknowns = new Set<Promise<unknown>>([Promise.resolve<unknown>("x"), Promise.resolve<unknown>(5)]);
  for (const result of await Promise.allSettled(unknowns)) {
    if (result.status === "fulfilled") console.log("unknown", String(result.value));
  }
  const ticks: string[] = [];
  const done = Promise.allSettled(new Set([Promise.resolve(1)])).then(() => { ticks.push("settled"); });
  ticks.push("sync");
  await done;
  console.log("turns", ticks.join(","));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
