class Options {
  constructor({ first, middle = "default", last }) {
    console.log(first, middle, last);
  }
}

new Options(Object.assign({ first: "start" }, {}));
new Options({ first: "explicit", middle: undefined, last: null });
const effects = [];
const observed = {
  get first() { effects.push("first"); return "read"; },
  get last() { effects.push("last"); return 7; },
};
new Options(observed);
console.log(effects.join(","));

const marker = new Error("getter");
try {
  new Options({ get first() { throw marker; } });
} catch (error) {
  console.log(error === marker);
}
