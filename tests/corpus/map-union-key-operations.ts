type Rows = Map<number, number> | Map<number, {name: string}>;
function prune(map: Rows): void {
  for (const key of map.keys()) if (key === 1) map.delete(key);
}
const numbers = new Map<number,number>([[1, 10], [2, 20]]);
const records = new Map<number,{name:string}>([[1, {name:"one"}], [2, {name:"two"}]]);
for (const map of [numbers, records]) prune(map);
console.log("prune", numbers.has(1), numbers.has(2), records.has(1), records.get(2)?.name);
function cursor(map:Rows): MapIterator<number> { return map.keys(); }
function has(map:Rows,key:number):boolean {return map.has(key);}
function remove(map:Rows,key:number):boolean {return map.delete(key);}
function clear(map:Rows):void {map.clear();}
const keys=cursor(numbers);
numbers.set(3,30);
console.log("first",keys.next().value);
remove(numbers,3);
numbers.set(4,40);
console.log("live", keys.next().value,keys.next().done);
numbers.set(5,50);
console.log("exhausted",keys.next().done,has(numbers,5),remove(numbers,999));
const next=cursor(records);
clear(records);
records.set(6,{name:"six"});
console.log("clear-live",next.next().value,next.next().done,records.get(6)?.name);
function owned(useRecords:boolean):MapIterator<number> {
 const n=new Map<number,number>([[7,70]]);
 const r=new Map<number,{name:string}>([[8,{name:"eight"}]]);
 return cursor(useRecords?r:n);
}
console.log("retained",owned(false).next().value,owned(true).next().value);
const events:string[]=[];
function receiver():Rows {events.push("receiver");return numbers;}
function key():number {events.push("key");return 5;}
console.log("order",receiver().has(key()),events.join(","));
const marker=new Error("key");
function throws():number {events.push("throw");throw marker;}
try {receiver().delete(throws());} catch(error) {console.log("throw",error===marker,has(numbers,5));}
console.log("recovery",receiver().delete(5),has(numbers,5));
numbers.set(NaN,99); numbers.set(-0,0);
console.log("same-value-zero",has(numbers,NaN),remove(numbers,NaN),has(numbers,0),remove(numbers,0));
const a={id:1}, b={id:2};
type ObjectRows=Map<typeof a,number>|Map<typeof a,string>;
const objects1=new Map<typeof a,number>([[a,10]]);
const objects2=new Map<typeof a,string>([[b,"b"]]);
function inspect(map:ObjectRows,key:typeof a):void {
 const step=map.keys().next();
 console.log("identity",map.has(key),!step.done && step.value===key,map.delete(key),map.has(key));
}
inspect(objects1,a); inspect(objects2,b);
function stringKeys(map:Map<string,number>|Map<string,boolean>):string {return [...map.keys()].join(",");}
console.log("strings",stringKeys(new Map<string,number>([["a",1],["b",2]])),stringKeys(new Map<string,boolean>([["c",true]])));

const arrayKey=[1,2];
function arrays(map:Map<number[],number>|Map<number[],string>,key:number[]):void {
 const step=map.keys().next();
 console.log("array-key",map.has(key),!step.done&&step.value===key,map.delete(key));
}
arrays(new Map<number[],number>([[arrayKey,1]]),arrayKey);
arrays(new Map<number[],string>([[arrayKey,"one"]]),arrayKey);
