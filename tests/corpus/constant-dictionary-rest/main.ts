import { color as colorKey } from "./key.ts";

function copy(attributes: Record<string, string>) {
  const numeric = "2";
  const { [colorKey]: color = "missing", [numeric]: second = "absent", ["style"]: style, ...rest } =
    attributes;
  console.log(color, second, style, JSON.stringify(rest));
  rest["added"] = "fresh";
  console.log(JSON.stringify(attributes));
}
copy({ first: "a", [colorKey]: "blue", "2": "two", style: "italic", last: "z" });
copy({ first: "a", last: "z" });

function references(input: Record<string, { value: number }>) {
  const { [colorKey]: a, [colorKey]: b, ...rest } = input;
  console.log(a === b, rest.keep === input.keep, rest !== input, Object.keys(rest).join());
}
references({ [colorKey]: { value: 1 }, keep: { value: 2 } });

function order(input: Record<string, string>) {
  function read() {
    const { [name]: value, ...rest } = input;
    console.log(value, JSON.stringify(rest));
  }
  try {
    read();
  } catch (error) {
    console.log(error instanceof ReferenceError);
  }
  const name = "chosen";
  read();
}
order({ chosen: "yes", keep: "other" });
