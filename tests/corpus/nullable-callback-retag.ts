interface Info {n:number; mode:string;}
type Reply={kind:"ok"}|{kind:"skip"};
type Handler=((x:Info)=>Reply)|((x:Info)=>void);
type Source=(x:Info)=>Reply|undefined;
let created=0,calls=0;
const reply:Reply={kind:"ok"};
const sentinel={id:7};
function source(x:Info):Reply|undefined {calls++;x.n++;if(x.mode==="throw")throw sentinel;return x.mode==="ok"?reply:undefined;}
function make(mode:number):Source|null|undefined {created++;return mode===0?null:mode===1?undefined:source;}
function bridge(x:Source|null|undefined):Handler|null|undefined{return x;}
function captured(x:Source|null):Handler|null{return x && (info=>x(info));}
function invoke(h:Handler|null|undefined,x:Info):unknown{return h?.(x);}
const info:Info={n:0,mode:"ok"};
const h=bridge(make(2));
console.log("once",created,Object.is(h,source));
console.log("result",invoke(h,info)===reply,info.n,calls);
console.log("units",bridge(make(0))===null,bridge(make(1))===undefined,created);
let args=0;function argument():Info{args++;return info;}
bridge(null)?.(argument());bridge(undefined)?.(argument());
console.log("skip",args);
const nested=captured(source);
console.log("capture",invoke(nested,info)===reply,info.n,calls,captured(null)===null);
info.mode="none";console.log("undefined",invoke(h,info),info.n,calls);
info.mode="throw";try{invoke(nested,info);}catch(e){console.log("throw",e===sentinel,info.n,calls);}
info.mode="ok";console.log("recover",invoke(h,info)===reply,info.n,calls);
let factories=0;
function factory():Source|null {factories++;return source;}
const direct:Handler|null=factory();
console.log("direct",invoke(direct,info)===reply,factories,info.n,calls);
type Member=((this:{value:number},x:number)=>number)|((this:{value:number},x:number)=>void);
type MemberSource=(this:{value:number},x:number)=>number|undefined;
function member(this:{value:number},x:number):number|undefined{return x?this.value+x:undefined;}
function memberBridge(x:MemberSource|null):Member|null{return x;}
const holder={value:9,callback:memberBridge(member)};
console.log("receiver",holder.callback?.(3),holder.callback?.(0),Object.is(holder.callback,member));
export {};
