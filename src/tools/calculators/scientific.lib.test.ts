import { describe, it, expect } from 'vitest';
import { evaluate } from './scientific.lib';

describe('evaluate', () => {
  it.each([
    ['1+2*3', 7],
    ['(1+2)*3', 9],
    ['2^3^2', 512],        // right-associative
    ['-3+5', 2],
    ['-(2+3)', -5],
    ['10/4', 2.5],
    ['2*-3', -6],
    ['sqrt(16)', 4],
    ['abs(-7)', 7],
    ['2*pi', 2 * Math.PI],
    ['ln(e)', 1],
    ['log(1000)', 3],
    ['1e3+1', 1001],
  ])('evaluates %s = %d', (expr, expected) => {
    expect(evaluate(expr)).toBeCloseTo(expected, 10);
  });

  it('honors degree mode for trig', () => {
    expect(evaluate('sin(90)', 'deg')).toBeCloseTo(1, 10);
    expect(evaluate('cos(180)', 'deg')).toBeCloseTo(-1, 10);
    expect(evaluate('asin(1)', 'deg')).toBeCloseTo(90, 10);
  });

  it('uses radians by default', () => {
    expect(evaluate('sin(0)')).toBeCloseTo(0, 10);
  });

  it('accepts unicode operators', () => {
    expect(evaluate('6×7')).toBe(42);
    expect(evaluate('8÷2')).toBe(4);
  });

  it.each(['', '1+', '(1+2', '1+2)', 'foo(2)', '1/0', '2**3'])('throws on %s', (expr) => {
    expect(() => evaluate(expr)).toThrow();
  });
});
