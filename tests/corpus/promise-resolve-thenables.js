function resolveDynamic(value) { return Promise.resolve(value); }
const native = Promise.resolve("native");
console.log("identity", Promise.resolve(native) === native);
let reads = 0;
const trace = [];
const value = {
  label: "outer",
  get then() {
    reads++;
    trace.push("get");
    return function (resolve, reject) {
      trace.push(this.label);
      resolve({ then(next) { next(Promise.resolve("nested")); } });
      reject(new Error("late"));
      throw new Error("later");
    };
  },
};
const result = resolveDynamic(value);
trace.push("after");
console.log("value", await result, reads, trace.join(","));
try {
  await resolveDynamic({ get then() { throw new Error("getter"); } });
} catch (error) {
  console.log("rejected", error.message);
}
