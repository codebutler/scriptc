const stable = { enabled: false, count: 0, name: "initial" };
stable.enabled = true;
stable.count = 2;
stable.name = "ready";
console.log(stable.enabled, stable.count, stable.name);

const annotated: { state: boolean | string } = { state: false };
annotated.state = "ready";
console.log(annotated.state);
