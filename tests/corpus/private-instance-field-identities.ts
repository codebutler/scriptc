class BaseSlots {
 #count=1;
 #ref={value:10};
 #call=(n:number)=>n+this.#count;
 #laidOut(){return "base-method";}
 base(){return `${this.#count}:${this.#ref.value}:${this.#call(2)}:${this.#laidOut()}`;}
 changeBase(){this.#count++;this.#ref.value+=2;this.#call=(n:number)=>n*2;}
 otherBase(other:BaseSlots){return other.#count;}
 static checked(other:any):unknown{return other.#count;}
}
class OwnSlots extends BaseSlots {
 #count="own";
 #ref=[3,4];
 #call=(n:number)=>n+100;
 #laidOut={width:7};
 own(){return `${this.#count}:${this.#ref.join(",")}:${this.#call(2)}:${this.#laidOut.width}`;}
 changeOwn(){this.#count+="!";this.#ref.push(5);this.#call=(n:number)=>n+200;this.#laidOut={width:9};}
 otherOwn(other:OwnSlots){return other.#count;}
 static checked(other:any):unknown{return other.#count;}
}
class LeafSlots extends OwnSlots {
 #count={value:30};
 leaf(){return this.#count.value++;}
}
const value=new LeafSlots();
console.log("initial",value.base(),value.own(),value.leaf(),value.leaf());
value.changeOwn();console.log("own-change",value.base(),value.own());
value.changeBase();console.log("base-change",value.base(),value.own());
const other=new OwnSlots();console.log("other",value.otherBase(other),value.otherOwn(other));
console.log("checked",BaseSlots.checked(value),OwnSlots.checked(value));
for(const raw of [new BaseSlots(),{},null]){
 try{console.log("bad",OwnSlots.checked(raw));}catch(error){console.log("brand",error instanceof TypeError);}
}
console.log("keys",JSON.stringify(Object.keys(value)),JSON.stringify(value));
class ConstructorBase {
 #state:{value:number};
 constructor(n:number){this.#state={value:n};}
 base(){return this.#state.value;}
}
class ConstructorOwn extends ConstructorBase {
 #state:{text:string};
 #ready=false;
 constructor(text:string){super(8);this.#state={text};this.#ready=true;}
 own(){return `${this.#state.text}:${this.#ready}`;}
}
const built=new ConstructorOwn("ready");console.log("assigned",built.base(),built.own());
class DeferredOwn extends ConstructorBase {
 #state!:number;
 constructor(){super(11);this.initialize();}
 initialize(){this.#state=12;}
 own(){return this.#state;}
}
const deferred=new DeferredOwn();console.log("deferred",deferred.base(),deferred.own());
class GenericBox<T> {
 #value:T;
 constructor(value:T){this.#value=value;}
 read(other:GenericBox<T>):T{return other.#value;}
 write(value:T){this.#value=value;}
 static read<T>(box:GenericBox<T>):T{return box.#value;}
}
const num=new GenericBox(3);const str=new GenericBox("s");num.write(4);str.write("t");
console.log("generic",num.read(num),str.read(str),GenericBox.read(num),GenericBox.read(str));
let receivers=0,args=0;
class CallableOwner {
 #call=(n:number)=>n+5;
 static run(value:CallableOwner){return receive(value).#call(argument());}
}
function receive(value:CallableOwner):CallableOwner{receivers++;return value;}
function argument():number{args++;return 3;}
console.log("once",CallableOwner.run(new CallableOwner()),receivers,args);
class BarePrivate {
 #value?:number;
 #initial=this.read();
 constructor(){console.log("bare-initial",this.#initial,this.read());this.#value=7;}
 read(){return this.#value;}
}
console.log("bare-final",new BarePrivate().read());
class BareGeneric<T>{
 #value?:T;
 constructor(){console.log("generic-bare",this.read());}
 read(){return this.#value;}
}
new BareGeneric<number>();
export {};
