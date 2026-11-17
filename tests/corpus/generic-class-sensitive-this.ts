const events: string[] = [];
class RowNode {
  label: string;
  constructor(label: string) { this.label = label; }
  dispose(): void { events.push("node:" + this.label); }
}
interface KeyedChild<T> {
  value: T;
  readonly node: RowNode;
  readonly dispose?: () => void;
  readonly update?: (value: T) => void;
}
class KeyedChildren<T, K> {
  #records = new Map<K, KeyedChild<T>>();
  reconcile(values: readonly T[], key: (value: T) => K, create: (value: T) => Omit<KeyedChild<T>, "value">): readonly RowNode[] {
    const next = new Map<K, KeyedChild<T>>();
    for (const value of values) {
      const id = key(value);
      if (next.has(id)) throw new Error("duplicate key");
      const existing = this.#records.get(id);
      if (existing) {
        existing.value = value;
        existing.update?.(value);
        next.set(id, existing);
      } else next.set(id, { value, ...create(value) });
    }
    const removed: KeyedChild<T>[] = [];
    for (const [id, record] of this.#records) if (!next.has(id)) removed.push(record);
    for (const record of removed) { record.dispose?.(); record.node.dispose(); }
    this.#records = next;
    return [...next.values()].map(record => record.node);
  }
  dispose(): void {
    for (const record of this.#records.values()) { record.dispose?.(); record.node.dispose(); }
    this.#records.clear();
  }
}
type Row = { index: number; item: unknown } | { empty: true; label: string };
const EMPTY_ROW = Symbol("empty");
function rowLabel(row: Row): string { return "index" in row ? String(row.index) : row.label; }
function rowKey(row: Row): string | typeof EMPTY_ROW { return "index" in row ? String(row.index) : EMPTY_ROW; }
function createRow(row: Row): Omit<KeyedChild<Row>, "value"> {
  const label = rowLabel(row);
  return { node: new RowNode(label), update: value => events.push("update:" + rowLabel(value)), dispose: () => events.push("dispose:" + label) };
}
function exerciseRows(rows: KeyedChildren<Row, string | typeof EMPTY_ROW>): void {
  const first = rows.reconcile([{ index: 1, item: "a" }, { empty: true, label: "empty" }], rowKey, createRow);
  const second = rows.reconcile([{ index: 1, item: "b" }, { index: 2, item: "c" }], rowKey, createRow);
  console.log("row identity", first[0] === second[0], second.map(node => node.label).join(","));
  rows.reconcile([{ index: 2, item: "d" }], rowKey, createRow);
  rows.dispose();
  rows.dispose();
  console.log("rows", events.join("|"));
  events.length = 0;
}
function exerciseNumbers(rows: KeyedChildren<number, string>): void {
  const first = rows.reconcile([1, 2], value => String(value), value => ({ node: new RowNode(String(value)) }));
  const second = rows.reconcile([2, 3], value => String(value), value => ({ node: new RowNode(String(value)) }));
  console.log("number identity", first[1] === second[0], second.map(node => node.label).join(","));
  rows.dispose();
  console.log("numbers", events.join("|"));
  events.length = 0;
}
function rowFirst(): void {
  const rows = new KeyedChildren<Row, string | typeof EMPTY_ROW>();
  const numbers = new KeyedChildren<number, string>();
  exerciseRows(rows); exerciseNumbers(numbers);
}
function numberFirst(): void {
  const numbers = new KeyedChildren<number, string>();
  const rows = new KeyedChildren<Row, string | typeof EMPTY_ROW>();
  exerciseNumbers(numbers); exerciseRows(rows);
}
class Choice<K> {
  value: K extends "yes" ? true : false;
  constructor(value: K extends "yes" ? true : false) { this.value = value; }
  read(): K extends "yes" ? true : false { return this.value; }
}
rowFirst(); numberFirst();
const yes = new Choice<"yes">(true), no = new Choice<"no">(false);
const noAgain = new Choice<"no">(false), yesAgain = new Choice<"yes">(true);
console.log("choices", yes.read(), no.read(), noAgain.read(), yesAgain.read());
export {};
