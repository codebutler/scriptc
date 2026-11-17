interface Layout { width:number; dispose():void }
async function main():Promise<void> {
  const item:Layout={width:3,dispose(){console.log("disposed",this.width);}};
  const original=Promise.resolve(item);
  const other=Promise.resolve(item);
  const widened:Promise<unknown>=original;
  const pending=new Promise<Layout>(resolve=>setTimeout(()=>resolve(item),1));
  const set=new Set<Promise<unknown>>();
  set.add(original);set.add(widened);set.add(original);set.add(other);set.add(pending);
  console.log("members",set.size,set.has(original),set.has(widened),set.has(pending));
  const map=new Map<Promise<unknown>,string>();
  map.set(original,"first");map.set(widened,"second");map.set(other,"other");map.set(pending,"pending");
  console.log("names",map.size,map.get(original),map.get(widened),map.get(other),map.get(pending));
  for(const member of set)console.log("payload",(await member)===item);
  console.log("settled",set.has(pending),map.get(pending));
  console.log("delete",set.delete(original),set.has(widened),set.size,map.delete(widened),map.has(original));
  set.add(widened);console.log("reinsert",set.has(original),set.size);
  const union=new Set<Promise<unknown>|undefined>();union.add(original);union.add(widened);union.add(undefined);
  console.log("union",union.size,union.has(original),union.has(undefined),union.delete(widened));
  const reason={kind:"reason"};const rejected=Promise.reject<Layout>(reason);
  const failures=new Set<Promise<unknown>>();failures.add(rejected);failures.add(rejected);
  try {await [...failures][0];} catch(error) {console.log("rejection",error===reason,failures.size,failures.has(rejected));}
  console.log("failure delete",failures.delete(rejected),failures.size);
  for(let i=0;i<48;i++) {const work=Promise.resolve(item);set.add(work);if(!set.has(work)||!set.delete(work))throw new Error("key lost");}
  const read=(await widened) as Layout;read.width=7;read.dispose();
  console.log("final",set.size,item.width);
}
void main();
