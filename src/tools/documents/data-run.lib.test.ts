import { describe, it, expect } from 'vitest';
import { peekData } from './data-run.lib';

describe('peekData', () => {
  it('reports CSV dimensions and shows the first rows', () => {
    const out = peekData('name,qty\nApple,3\nBanana,5\nCherry,2');
    expect(out).toMatch(/4 lines, ~2 columns \(CSV\)/);
    expect(out).toContain('name,qty');
    expect(out).toContain('Apple,3');
  });
  it('truncates long inputs with an ellipsis', () => {
    const many = Array.from({ length: 40 }, (_, i) => `row${i}`).join('\n');
    const out = peekData(many, 5);
    expect(out).toContain('row0');
    expect(out).toContain('…');
    expect(out).not.toContain('row30');
  });
});
