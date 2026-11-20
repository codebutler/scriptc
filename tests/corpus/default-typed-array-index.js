function decode(input, Type = Uint16Array) {
  if (typeof input !== "string") return input;
  let array = null;
  let index = 0;
  for (let i = 0; i < input.length; i++) {
    if (array) {
      array[index++] = 65536 + input.charCodeAt(i);
      console.log(index, array[index - 1]);
    } else {
      array = new Type(input.length - 1);
    }
  }
  if (array) {
    array[index] = 42;
    console.log(array[index] === undefined);
  }
  return array;
}
const narrow = decode("!AB");
const wide = decode("!AB", Uint32Array);
console.log(narrow instanceof Uint16Array, wide instanceof Uint32Array, narrow[1], wide[0]);
console.log(decode(wide) === wide);
