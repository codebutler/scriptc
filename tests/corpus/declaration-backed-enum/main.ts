import { Mode as Alias, setCurrent } from "./mode.mjs";
import * as lib from "./mode.mjs";

console.log(Alias.First);
setCurrent(8);
console.log(lib.Mode.First);
console.log(Alias["First"]);
console.log(Alias.Second);
