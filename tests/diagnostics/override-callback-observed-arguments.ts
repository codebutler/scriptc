class Widget {
  onBlur(handler: () => void): this { handler(); return this; }
}
class Field extends Widget {
  override onBlur(handler: (value: string) => void): this { handler("edited"); return this; }
}
function register(widget: Widget): void {
  widget.onBlur(function () { console.log("base callback", arguments.length, arguments[0]); });
}
const field = new Field();
field.onBlur(value => console.log("field callback", value));
register(field);
register(new Widget());
export {};
