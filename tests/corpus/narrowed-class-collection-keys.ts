// A collection consumes the class reference selected by an instanceof
// guard, even when for-of/capture storage retains the whole input union.
class Command {
  id: number;
  constructor(id: number) { this.id = id; }
  run(): number { return this.id; }
  toolButton(style: string): Button { return new Button(style + ":" + this.id); }
}

class Widget {
  label: string;
  constructor(label: string) { this.label = label; }
}

class Button extends Widget {}

class SpecialCommand extends Command {
  detail = "special";
}

class FurtherCommand extends SpecialCommand {
  extra = 42;
}

type Part = Command | Widget | string | null;
const events: string[] = [];

function toolbar(parts: readonly Part[], first: Command, duplicate: Command,
                 special: SpecialCommand, further: FurtherCommand): void {
  const keep = new Set<Command>();
  const buttons = new Map<Command, string>();
  let admitted = 0;
  for (const part of parts) {
    if (part === null) continue;
    if (typeof part === "string") continue;
    if (part instanceof Command) {
      keep.add(part);
      buttons.set(part, "button:" + part.id);
      console.log("inside", part.id, keep.has(part), buttons.has(part),
        buttons.get(part) === "button:" + part.id);
      // Like the toolbar's deferred button builder, this closure captures
      // the loop binding whose storage also holds Widget/string/null.
      const captured = (): string => {
        return part.run() + ":" + keep.has(part) + ":" + buttons.get(part);
      };
      console.log("captured", captured());
      admitted++;
    }
  }
  console.log("counts", admitted, keep.size, buttons.size);
  console.log("same fields distinct", first !== duplicate, keep.has(first), keep.has(duplicate),
    buttons.get(first), buttons.get(duplicate));
  console.log("subclasses", keep.has(special), keep.has(further),
    buttons.get(special), buttons.get(further), further.extra);
  console.log("set delete", keep.delete(first), keep.has(first), keep.has(duplicate),
    keep.delete(first), keep.size);
  console.log("map delete", buttons.delete(first), buttons.has(first), buttons.has(duplicate),
    buttons.get(duplicate), buttons.delete(first), buttons.size);
  keep.add(first);
  buttons.set(first, "reinserted");
  console.log("reinsert", keep.has(first), buttons.get(first), keep.size, buttons.size);

  // A fresh same-field object never becomes an existing reference key.
  const unrelated = new Command(first.id);
  console.log("unrelated", keep.has(unrelated), buttons.has(unrelated),
    keep.delete(unrelated), buttons.delete(unrelated));
}

class KeySource {
  reads = 0;
  first: Part;
  next: Part;

  constructor(first: Part, next: Part) {
    this.first = first;
    this.next = next;
  }

  get current(): Part {
    this.reads++;
    events.push("key " + this.reads);
    return this.reads === 1 ? this.first : this.next;
  }
}

function effectfulReads(first: Command, next: FurtherCommand): void {
  const source = new KeySource(first, next);
  const map = new Map<Command, string>();
  function receiver(): Map<Command, string> {
    events.push("map receiver");
    return map;
  }
  function value(): string {
    events.push("value");
    return "stored";
  }
  if (source.current instanceof Command) {
    receiver().set(source.current, value());
    console.log("current read stored", source.reads, map.has(first), map.has(next));
    console.log("current get", receiver().get(source.current));
    console.log("current has", receiver().has(source.current));
    console.log("current delete", receiver().delete(source.current));
  }
  console.log("map getter order", source.reads, events.join(" | "), map.size);
  events.length = 0;

  const setSource = new KeySource(first, next);
  const set = new Set<Command>();
  function setReceiver(): Set<Command> {
    events.push("set receiver");
    return set;
  }
  if (setSource.current instanceof Command) {
    setReceiver().add(setSource.current);
    console.log("set current read", setSource.reads, set.has(first), set.has(next));
    console.log("set current has", setReceiver().has(setSource.current));
    console.log("set current delete", setReceiver().delete(setSource.current));
  }
  console.log("set getter order", setSource.reads, events.join(" | "), set.size);
  events.length = 0;

  const skipped = new KeySource(new Widget("not command"), next);
  if (skipped.current instanceof Command) map.set(skipped.current, "unreachable");
  console.log("guard skip", skipped.reads, events.join(" | "), map.size);
  events.length = 0;
}

function capturedConsumer(value: Part): () => boolean {
  const set = new Set<Command>();
  const map = new Map<Command, number>();
  if (value instanceof Command) {
    return () => {
      set.add(value);
      map.set(value, value.id);
      const found = set.has(value) && map.has(value) && map.get(value) === value.id;
      return found && set.delete(value) && map.delete(value);
    };
  }
  return () => false;
}

function detachedRoot<T>(fn: () => T): T {
  return fn();
}

// The real toolbar combines a private command cache, a checked-dynamic
// build snapshot, and a callback capturing part inside a cache-miss branch.
class ToolbarCache {
  #buttons = new Map<Command, Button>();
  #buttonLabels: string | null = null;
  #built: readonly unknown[] = [];
  #children: Widget[] = [];

  show(labels: string, parts: readonly Part[]): void {
    this.#show(labels, parts);
  }

  describe(): string {
    return this.#children.map((child) => child.label).join(",");
  }

  count(): number { return this.#buttons.size; }

  #show(labels: string, parts: readonly Part[]): void {
    const built = [labels, ...parts];
    if (built.length === this.#built.length && built.every((part, i) => part === this.#built[i]))
      return;
    this.#built = built;
    if (labels !== this.#buttonLabels) {
      this.#buttons.clear();
      this.#buttonLabels = labels;
    }
    const keep = new Set<Command>();
    const children: Widget[] = [];
    for (const part of parts) {
      if (part === null) continue;
      if (part === "separator") children.push(new Widget("separator"));
      else if (part === "space") children.push(new Widget("space"));
      else if (part === "flexible-space") children.push(new Widget("flexible-space"));
      else if (typeof part === "string") continue;
      else if (part instanceof Command) {
        keep.add(part);
        let button = this.#buttons.get(part);
        if (!button) {
          button = detachedRoot(() =>
            part.toolButton(labels === "icons-and-text" ? "iconLabel" : "tool"),
          );
          this.#buttons.set(part, button);
        }
        children.push(button);
      } else children.push(part);
    }
    for (const [command] of this.#buttons) {
      if (keep.has(command)) continue;
      this.#buttons.delete(command);
    }
    this.#children = children;
  }
}

const first = new Command(7);
const duplicate = new Command(7);
const special = new SpecialCommand(8);
const further = new FurtherCommand(9);
const parts: readonly Part[] = [null, "separator", new Widget("content"),
  first, first, duplicate, special, further];
toolbar(parts, first, duplicate, special, further);
effectfulReads(first, further);
const captured = capturedConsumer(further);
console.log("later capture", captured(), captured(), capturedConsumer(null)());
const cache = new ToolbarCache();
cache.show("icons", parts);
console.log("private cache first", cache.count(), cache.describe());
cache.show("icons", parts);
console.log("private cache unchanged", cache.count(), cache.describe());
cache.show("icons-and-text", [duplicate, further, duplicate]);
console.log("private cache restyled", cache.count(), cache.describe());
cache.show("icons-and-text", [further]);
console.log("private cache removed", cache.count(), cache.describe());

// Index reads introduce hidden undefined storage. Keeping the reference
// in a closure must not prevent its guarded use as an identity key.
function indexedHeldSet(label: string, parts: readonly Part[], expected: Command | null): void {
  const set = new Set<Command>();
  const part = parts[0];
  if (part instanceof Command) {
    const later = () => part.run();
    set.add(part);
    console.log("indexed set", label, later(), set.has(part), part === expected, set.size);
    console.log("indexed set delete", set.delete(part), set.has(part), set.size);
  } else console.log("indexed set skipped", label, set.size);
}

function indexedHeldMap(label: string, parts: readonly Part[], expected: Command | null): void {
  const map = new Map<Command, number>();
  const part = parts[0];
  if (part instanceof Command) {
    const later = () => part.run();
    map.set(part, part.id);
    console.log("indexed map", label, later(), map.get(part), map.has(part),
      part === expected, map.size);
    console.log("indexed map delete", map.delete(part), map.has(part), map.size);
  } else console.log("indexed map skipped", label, map.size);
}

function indexedOutOfBounds(parts: readonly Part[]): void {
  const set = new Set<Command>();
  const map = new Map<Command, number>();
  const part = parts[99];
  if (part instanceof Command) {
    const later = () => part.run();
    set.add(part);
    map.set(part, later());
    console.log("unexpected bounds", set.has(part), map.get(part));
  } else console.log("indexed bounds skipped", set.size, map.size);
}

indexedHeldSet("first", [first], first);
indexedHeldSet("same fields distinct", [duplicate], duplicate);
indexedHeldSet("descendant", [further], further);
indexedHeldSet("empty", [], null);
indexedHeldSet("widget", [new Widget("not a command")], null);
indexedHeldSet("null", [null], null);
indexedHeldMap("first", [first], first);
indexedHeldMap("same fields distinct", [duplicate], duplicate);
indexedHeldMap("descendant", [further], further);
indexedHeldMap("empty", [], null);
indexedHeldMap("string", ["separator"], null);
indexedHeldMap("null", [null], null);
indexedOutOfBounds([first, further]);
