interface Work { run<T>(fn: () => T, label?: string): T; }
const work: Work = { run: fn => fn() };
const args: [() => void, string?] = [() => { console.log("call"); }];
// A stored void callback in an optional tuple has no inferred return override.
work.run<void>(...args);
