const methods = { plus(n) { return this.value + n; } };
export function make() { const value = Object.create(methods); value.value = 7; return value; }
export function next(g) { return g.next(); }
export function same(a,b) { return a === b; }
