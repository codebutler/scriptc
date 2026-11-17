interface Row {value:number; label:string;}
const row:Row={value:1,label:"start"};
const values:number[]=[2];
let calls=0;
function mutate(a:Row,b:Row,items:number[]):Row {
  console.log("same",a===row,a===b,items===values);
  a.value++;b.label="changed";items.push(a.value);calls++;
  return a;
}
const boxed:unknown=mutate;
const checked=boxed as (a:Row,b:Row,items:number[])=>void;
checked(row,row,values);
console.log("after",row.value,row.label,JSON.stringify(values),calls);
const saved:Row[]=[];
function retain(a:Row|undefined):void {if(a){a.value++;saved.push(a);}}
const raw:unknown=retain;
const keep=raw as (a:Row|undefined)=>void;
keep(row);keep(undefined);row.label="late";
console.log("retained",saved[0]===row,saved[0]?.label,row.value);
const sentinel={id:7};
function fail(a:Row,items:number[]):void {a.value++;items.push(9);throw sentinel;}
const rawFail:unknown=fail;
const checkedFail=rawFail as (a:Row,items:number[])=>void;
try{checkedFail(row,values);}catch(error){console.log("throw",error===sentinel);}
console.log("after throw",row.value,JSON.stringify(values));
checked(row,row,values);console.log("recovery",row.value,calls);
export {};
