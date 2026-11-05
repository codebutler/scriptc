// Statically shaped thenables keep their explicit refusal; this change
// adopts values crossing the checked-dynamic boundary instead.
const value = { then(resolve: (value: number) => void) { resolve(1); } };
console.log(Promise.resolve(value));
