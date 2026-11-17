interface Kit { color(n:number):number; parse(s:string):number; make():number; size(input:ArrayBuffer|Uint8Array):number }
function create(seed:number): Kit {
 const kit:Kit={
  color(n) { return n+seed; },
  parse(s) { return kit.color(Number(s)); },
  size(input:ArrayBuffer|Uint8Array) { return input.byteLength; },
  make() { return later(); },
 };
 const later=kit.parse.bind(kit,"7");
 return kit;
}
const first=create(1),second=create(2);
console.log(first.parse("3"),first.make(),second.make());
console.log(first.size(new Uint8Array([1,2,3])));
