// Calls through the base enter the inherited slot. The derived method supplies
// its text to a callback and returns the same receiver.
class Widget {
  onBlur(handler: () => void): this {
    handler();
    return this;
  }
}

const shared = () => console.log("shared");
class Field extends Widget {
  override onBlur(handler: (value: string) => void): this {
    console.log("same handler", handler === shared);
    handler("edited");
    return this;
  }
}
class Child extends Field {
  observe(): void {
    super.onBlur(value => console.log("super", value));
  }
}
function register(widget: Widget): void {
  console.log("same widget", widget.onBlur(shared) === widget);
}

const field = new Field();
register(field);
register(new Widget());
new Child().observe();
field.onBlur(value => console.log("direct", value));
field.onBlur.bind(field)(value => console.log("bound", value));
const sentinel = {};
try {
  field.onBlur(() => { throw sentinel; });
} catch (error) {
  console.log("same error", error === sentinel);
}
Field.prototype.onBlur = function (handler: (value: string) => void): Field {
  handler("replacement");
  return this;
};
field.onBlur(value => console.log("replaced", value));
export {};
