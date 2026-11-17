type Sink=(value:number)=>void;
interface Options { readonly command:(value:number)=>number; readonly event?:Sink; }
class Controller {
 readonly events=new Set<Sink>();
 constructor(options:Options){if(options.event)this.events.add(options.event);}
 command(value:number):number{return value;}
 collect(options:Options):void {if(options.event){this.events.add(options.event);console.log("contains",this.events.has(options.event));}}
 remove(options:Options):boolean {return options.event?this.events.delete(options.event):false;}
}
let calls=0;
const sink:Sink=value=>{calls+=value;};
const options:Options={command:n=>n,event:sink};
const c=new Controller(options);
c.collect(options);c.collect(options);
console.log("set",c.events.size,c.events.has(sink));
for(const f of c.events)f(3);
console.log("calls",calls,c.remove(options),c.events.size);
c.collect(options);console.log("original-delete",c.events.delete(sink),c.events.size);
function mapped(options:Options):void{
 const m=new Map<Sink,number>();
 if(options.event){m.set(options.event,4);m.set(options.event,7);console.log("map",m.size,m.get(options.event),m.has(options.event),m.delete(options.event),m.size);}
}
mapped(options);
const wide:(value:number)=>number=value=>{calls+=value;return calls;};
const raw:unknown=wide;
const checked=raw as Sink;
const viewed:Options={command:n=>n,event:checked};
const d=new Controller(viewed);d.collect(viewed);
console.log("checked",d.events.size,d.events.has(checked),d.events.delete(checked),d.events.size);
let gets=0;const first:Sink=()=>{calls+=10;};const second:Sink=()=>{calls+=100;};
const getterOptions:Options={command:n=>n,get event(){gets++;return gets===1?first:second;}};
const g=new Controller(getterOptions);
console.log("getter",gets,g.events.has(first),g.events.has(second));
for(const f of g.events)f(0);
console.log("getter-calls",calls);
const empty=new Controller({command:n=>n});console.log("empty",empty.events.size);
let builds=0;function make():Options{builds++;return options;}
const made=new Controller(make());console.log("once",builds,made.events.has(sink));
const sentinel={id:9};const throws:Sink=()=>{throw sentinel;};
const t=new Controller({command:n=>n,event:throws});try{for(const f of t.events)f(0);}catch(error){console.log("throw",error===sentinel,t.events.has(throws));}
console.log("recovery",t.events.delete(throws),t.events.size);
export {};
