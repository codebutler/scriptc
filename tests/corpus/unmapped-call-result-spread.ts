type Role="body"|"mono";
interface Assets {stacks:Readonly<Partial<Record<Role,readonly string[]>>>}
class Fonts {
 #assets:Assets={stacks:{body:["original"]}};
 #fallbackIds:readonly string[]=["fallback"];
 async replace(stacks:Readonly<Partial<Record<Role,readonly string[]>>>):Promise<void>{
  for(const [role,stack] of Object.entries(stacks) as [Role,readonly string[]][]) console.log(role,stack.join(","));
  this.#assets={...this.#assets,stacks:{...this.#assets.stacks,...Object.fromEntries(Object.entries(stacks).map(([role,stack])=>[role,[...new Set([...stack,...this.#fallbackIds])]]))}};
 }
 result(){return this.#assets;}
}
const fonts=new Fonts();await fonts.replace({mono:["mono"]});console.log(JSON.stringify(fonts.result()));

interface WithBag {body?:readonly string[];mono?:readonly string[];bag:Readonly<Record<string,readonly string[]>>}
function withBag(stacks:Readonly<Partial<Record<Role,readonly string[]>>>,bag:Readonly<Record<string,readonly string[]>>):WithBag {
 for(const [role,stack] of Object.entries(stacks) as [Role,readonly string[]][]) console.log("bag source",role,stack.join(","));
 return {...Object.fromEntries(Object.entries(stacks).map(([role,stack])=>[role,[...new Set([...stack,"fallback"])]])),bag};
}
const bag:Readonly<Record<string,readonly string[]>>={body:["held"]};
const withBagResult=withBag({mono:["mono"]},bag);
console.log("bag identity",withBagResult.bag===bag,withBagResult.mono?.join(","));
