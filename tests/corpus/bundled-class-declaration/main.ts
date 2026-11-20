import { Counter as Bundled } from "./bundled.mjs";
import { Counter as Installed } from "counter-api";

class Holder {
  #counter: Bundled;
  constructor(value: number) { this.#counter = Bundled.create(value); }
  read() { return this.#counter; }
}

const a = new Holder(41).read();
const b = Installed.create(41);
console.log(a.value, b.value, Bundled === Installed);
console.log(a instanceof Bundled, a instanceof Installed, b instanceof Bundled, b instanceof Installed);
