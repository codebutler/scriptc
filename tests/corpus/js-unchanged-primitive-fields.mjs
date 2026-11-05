const stable = { enabled: false, count: 0, name: "initial" };
stable.enabled = true;
stable.count = 2;
stable.name = "ready";
console.log(stable.enabled, stable.count, stable.name);

/** @type {{ state: boolean | string }} */
const annotated = { state: false };
annotated.state = "ready";
console.log(annotated.state);
