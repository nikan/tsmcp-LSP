import { Greeter, Calculator } from './interfaces.js';

export class FriendlyGreeter implements Greeter {
  greet(name: string): string {
    return `Hey there, ${name}!`;
  }
}

export class SimpleCalculator implements Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}
