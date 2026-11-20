// The HTML parser checks for the method before using it.
console.log(String.prototype.codePointAt == null, typeof String.prototype.codePointAt);
const method = String.prototype.codePointAt;
const s = "A🌍B";
console.log(method === s.codePointAt, method.name, method.length);
for (const i of [undefined, null, NaN, -Infinity, -1, -0.5, 0, 1, 2, 3, 4, Infinity]) {
  console.log(i, method.call(s, i));
}
console.log(
  method.apply("🌍", [0]),
  method.call("\udc01", 0),
  method.call("\ud802", 0),
  method.call("\ud802x", 0),
);
const effects = [];
const receiver = {
  toString() {
    effects.push("receiver");
    return s;
  },
};
const index = {
  valueOf() {
    effects.push("index");
    return 1.9;
  },
};
console.log(method.call(receiver, index), effects.join(","));
for (const input of [null, undefined]) {
  try {
    method.call(input, index);
  } catch (e) {
    console.log(e.name, effects.length);
  }
}
try {
  method.call(Symbol("value"), index);
} catch (e) {
  console.log(e.name, effects.length);
}
try {
  method.call(receiver, Symbol("index"));
} catch (e) {
  console.log(e.name, effects.join(","));
}
try {
  method.call(receiver, 1n);
} catch (e) {
  console.log(e.name, effects.join(","));
}
const marker = {};
try {
  method.call(
    {
      toString() {
        throw marker;
      },
    },
    index,
  );
} catch (e) {
  console.log(e === marker);
}
try {
  method.call(receiver, {
    valueOf() {
      throw marker;
    },
  });
} catch (e) {
  console.log(e === marker);
}
