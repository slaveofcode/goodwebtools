import { describe, it, expect } from 'vitest';
import { transform, allStyles, STYLES } from './fancytext.lib';

describe('transform', () => {
  it('bold maps letters and digits', () => {
    expect(transform('AB', 'bold')).toBe(String.fromCodePoint(0x1d400, 0x1d401));
    expect(transform('0', 'bold')).toBe(String.fromCodePoint(0x1d7ce));
  });

  it('italic uses the Letterlike exception for h', () => {
    expect(transform('h', 'italic')).toBe('ℎ');
    expect(transform('a', 'italic')).toBe(String.fromCodePoint(0x1d44e));
  });

  it('double-struck uses exceptions', () => {
    expect(transform('C', 'doubleStruck')).toBe('ℂ');
    expect(transform('A', 'doubleStruck')).toBe(String.fromCodePoint(0x1d538));
  });

  it('circled digits map 0 → ⓪ and 1 → ①', () => {
    expect(transform('0', 'circled')).toBe('⓪');
    expect(transform('1', 'circled')).toBe('①');
  });

  it('combining styles append one mark per character', () => {
    expect(transform('ab', 'strikethrough')).toBe('a̶b̶');
    expect(transform('ab', 'underline')).toBe('a̲b̲');
  });

  it('passes through characters it does not map', () => {
    expect(transform('a b!', 'bold')).toBe(String.fromCodePoint(0x1d41a) + ' ' + String.fromCodePoint(0x1d41b) + '!');
  });
});

describe('allStyles', () => {
  it('returns one entry per style', () => {
    const r = allStyles('hi');
    expect(r).toHaveLength(STYLES.length);
    expect(r[0].id).toBe('bold');
    expect(r[0].output).toBe(transform('hi', 'bold'));
  });
});
