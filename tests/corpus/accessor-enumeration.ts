// Closed accessor records enumerate their live properties in construction order.

// live-values
{
let selected=1;const events:string[]=[];const assets={first:0,get chosen():number{events.push("get");return selected;},last:2};selected=7;console.log(JSON.stringify(Object.entries(assets)),events.join(","));

}

// mutates-later
{
const events:string[]=[];const value={get first():number{events.push("first");value.last=9;return 1;},last:2};console.log(JSON.stringify(Object.entries(value)),events.join(","));

}

// identity
{
const shared=[1,2];const value={first:shared,get second():number[]{return shared;}};const entries=Object.entries(value);console.log(entries[0]![1]===shared,entries[1]![1]===shared,entries[0]![1]===entries[1]![1]);

}

// keys-and-throw
{
let calls=0;const sentinel={x:1};const value={a:1,get b():number{calls++;throw sentinel;},c:3};console.log(Object.keys(value).join(","),calls);try{Object.values(value);}catch(error){console.log(error===sentinel,calls);}

}

// after-await
{
let selected=1;const value={a:0,get b():number{return selected;},c:2};async function run():Promise<void>{await Promise.resolve();selected=5;console.log(JSON.stringify(Object.entries(value)));}void run();

}

// numeric-order
{
const value={z:9,get "12"():number{return 12;},"2":2,get a():number{return 1;}};console.log(JSON.stringify(Object.entries(value)));

}

// get-and-set
{
let selected=1;let calls=0;const value={first:0,get choice():number{calls++;return selected;},set choice(v:number){selected=v;},last:2};value.choice=7;console.log(JSON.stringify(Object.entries(value)),calls);
}
export {};
