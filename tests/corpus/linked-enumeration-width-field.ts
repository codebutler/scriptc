interface Option { label?: number }
interface Narrow { option: Option; count: number }
interface Wide { option: Option; count: number; payload: { extra: number } }
function inspect(narrow: Narrow) {
  for (const [key, value] of Object.entries(narrow)) {
    console.log(key, JSON.stringify(value));
  }
  console.log(JSON.stringify(Object.values(narrow)));
}
const wide: Wide={ option:{label:1},count:3,payload:{extra:7} };
inspect(wide);
export {};
