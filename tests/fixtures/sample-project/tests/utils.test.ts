import { greet, add } from '../src/utils.js';

// Exercise cross-scope references: these usages should be visible
// to ts_references when querying from src/utils.ts
const greeting = greet('Test');
console.log(greeting);

const sum = add(10, 20);
console.log(sum);
