const error = new Error("js");
for (const value of [false, 0, null, undefined, "text", {}]) {
  error.stack = value;
  console.log(typeof error.stack, error.stack === value);
}
