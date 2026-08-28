import { describe, it, expect } from 'vitest';
import { extractCode } from './canvas-run.lib';

describe('extractCode', () => {
  it('pulls code out of a js fence', () => {
    expect(extractCode('Sure:\n```js\nctx.fillRect(0,0,10,10)\n```\ndone')).toBe('ctx.fillRect(0,0,10,10)');
  });
  it('returns the raw text when there is no fence', () => {
    expect(extractCode('ctx.fillStyle="red"')).toBe('ctx.fillStyle="red"');
  });
});
