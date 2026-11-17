interface Info { key:string; count:number; }
type Reply={type:"consume"}|{type:"ignored"};
type Handler=((info:Info)=>Reply)|((info:Info)=>void);
const reply:Reply={type:"consume"};
let calls=0;
function wider(info:Info):Reply|undefined {calls++;info.count++;return info.key==="reply"?reply:undefined;}
function wrap(handler:Handler|null):Handler|null{return info=>handler?.(info);}
function invoke(handler:Handler|null,info:Info):unknown{return handler?.(info);}
const info:Info={key:"reply",count:0};
const adapted:Handler|null=wider;
console.log("identity",Object.is(adapted,wider));
console.log("reply",JSON.stringify(invoke(adapted,info)),info.count,calls);
console.log("result identity",Object.is(invoke(adapted,info),reply),info.count,calls);
if(adapted){adapted(info);console.log("narrowed effects",info.count,calls);}
info.key="none";console.log("undefined",invoke(adapted,info),info.count,calls);
const captured=wrap(adapted);info.key="reply";
console.log("captured",JSON.stringify(invoke(captured,info)),info.count,calls);
console.log("null",invoke(wrap(null),info),info.count,calls);
let creates=0;
function create(): (info:Info)=>Reply|undefined {creates++;return wider;}
const once:Handler|null=create();
console.log("once",JSON.stringify(invoke(once,info)),creates,info.count,calls);
const contextual:Handler|null=(value:Info)=>value.key==="reply"?reply:undefined;
console.log("contextual",JSON.stringify(invoke(contextual,info)));
const sentinel={id:42};
const throwing:Handler|null=(_info:Info)=>{throw sentinel;};
try{invoke(throwing,info);}catch(error){console.log("throw",error===sentinel);}
console.log("recover",JSON.stringify(invoke(adapted,info)));
type Scalar=((x:number)=>number)|((x:number)=>void);
function scalar(handler:Scalar|null|undefined):unknown{return handler?.(4);}
console.log("scalar",scalar((x:number)=>x+1),scalar(null),scalar(undefined));
type Member=((this:{value:number},x:number)=>number)|((this:{value:number},x:number)=>void);
function member(this:{value:number},x:number):number|undefined{return x?this.value+x:undefined;}
const holder:{value:number;callback:Member|null}={value:7,callback:member};
console.log("receiver",holder.callback?.(2),holder.callback?.(0),Object.is(holder.callback,member));
// A checked void view retains the original scalar-returning callable.
function actual(x:number):number{return x+1;}
const raw:unknown=actual;
const view=raw as (x:number)=>void;
type Viewed=((x:number)=>string)|((x:number)=>void);
function viewCall(handler:Viewed|null):unknown{return handler?.(8);}
console.log("prior checked view",viewCall(view),Object.is(view,actual));
export {};
