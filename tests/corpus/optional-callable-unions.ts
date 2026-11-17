interface Info { key:string; count:number; }
type Reply = { type:"consume" }|{type:"ignored"};
type Handler = ((info:Info)=>Reply)|((info:Info)=>void);
function consume(info:Info):Reply {info.count++;return {type:"consume"};}
function observe(info:Info):void {info.count+=2;console.log("observe",info.key);}
function invoke(handler:Handler|null|undefined,info:Info):unknown{return handler?.(info);}
function captured(handler:Handler|null){return (info:Info):unknown=>handler?.(info);}
const info:Info={key:"key",count:0};
console.log("null",invoke(null,info),invoke(undefined,info),info.count);
console.log("reply",JSON.stringify(invoke(consume,info)),info.count);
console.log("void",invoke(observe,info),info.count);
const later=captured(consume);info.key="later";
console.log("capture",JSON.stringify(later(info)),info.count);
let argumentReads=0;
function argument():Info {argumentReads++;return info;}
function lazy(handler:Handler|null):unknown{return handler?.(argument());}
lazy(null);console.log("skip",argumentReads);lazy(observe);console.log("once",argumentReads);
const sentinel={id:42};
function fail(_info:Info):Reply {throw sentinel;}
try{invoke(fail,info);}catch(error){console.log("throw",error===sentinel);}
console.log("recover",JSON.stringify(invoke(consume,info)),info.count);
type Scalar = ((n:number)=>number)|((n:number)=>string);
function numberReply(n:number):number{return n+1;}
function stringReply(n:number):string{return "value"+n;}
function scalar(handler:Scalar|null):unknown{return handler?.(3);}
console.log("scalar",scalar(numberReply),scalar(stringReply),scalar(null));
type Member = ((this:{value:number},n:number)=>number)|((this:{value:number},n:number)=>void);
function member(this:{value:number},n:number):number{return this.value+n;}
const holder:{value:number;callback:Member|null}={value:7,callback:member};
let holderReads=0;
function getHolder(){holderReads++;return holder;}
console.log("receiver",getHolder().callback?.(4),holderReads);
holder.callback=null;console.log("absent member",getHolder().callback?.(4),holderReads);
type Dynamic = ((value:unknown)=>unknown)|((value:unknown)=>void);
function identity(value:unknown):unknown{return value;}
function dynamic(handler:Dynamic|null,value:unknown):unknown{return handler?.(value);}
const token:unknown=JSON.parse('{"id":7}');
console.log("identity",dynamic(identity,token)===token,dynamic(null,token));
const original:unknown=numberReply;
const voidView=original as (n:number)=>void;
type Viewed=((n:number)=>string)|((n:number)=>void);
function viewed(handler:Viewed|null):unknown{return handler?.(8);}
console.log("checked view",viewed(voidView));
let active:Member|null=member;
const accessor={value:10,get callback():Member|null {console.log("get");return active;}};
function memberArgument():number {console.log("argument");active=null;return 5;}
console.log("getter order",accessor.callback?.(memberArgument()));
console.log("getter null",accessor.callback?.(memberArgument()));
const throwingAccessor={value:1,get callback():Member|null {throw sentinel;}};
try{throwingAccessor.callback?.(memberArgument());}catch(error){console.log("getter throw",error===sentinel);}
export {};
