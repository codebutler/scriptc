class Owner {
  method(): string { return "initial"; }
}

class Widget extends Owner {
  constructor() {
    super();
    console.log(this.method());
  }
}

class GenericWidget<T> extends Widget {
  readonly value: T;
  constructor(value: T) {
    super();
    this.value = value;
  }
}

class StringWidget extends GenericWidget<string> {}

const original = Owner.prototype.method;
const numberWidget = new GenericWidget(4);
const stringWidget = new StringWidget("hello");
console.log(numberWidget.value, stringWidget.value, numberWidget.method === original);
Owner.prototype.method = function () { return "replaced"; };
console.log(numberWidget.method(), stringWidget.method(), new StringWidget("after").value);
numberWidget.method = function () { return "own"; };
console.log(numberWidget.method(), stringWidget.method());
export {};
