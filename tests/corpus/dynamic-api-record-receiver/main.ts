import { make } from "./library.mjs";
interface Api { value: number; plus(amount: number): number; }
const view = make() as Api;
try { console.log("direct", view.plus(2)); } catch (error) { console.log("direct error", error instanceof TypeError); }
const extracted = view.plus;
try { console.log("extracted", extracted(2)); } catch (error) { console.log("extracted error", error instanceof TypeError); }
let reads = 0;
function getView(): Api { reads++; return view; }
try { console.log("once", getView().plus(3)); } catch (error) { console.log("once error", error instanceof TypeError); }
console.log("reads", reads);
try { console.log("computed", view["plus"](4)); } catch (error) { console.log("computed error", error instanceof TypeError); }
function optional(value: Api | undefined): void { console.log("optional", value?.plus(5)); }
optional(view);
optional(undefined);
