const methods = { plus(amount) { return this.value + amount; } };
export function make() { const value = Object.create(methods); value.value = 5; return value; }
