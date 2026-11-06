import {make, walk} from './library.mjs';
interface Node { children?: {forEach(fn: (value: number) => void): void}; }
const node = make() as Node;
console.log(walk(node));
