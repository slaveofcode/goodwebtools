import { describe, it, expect } from 'vitest';
import { toBraille } from './braille.lib';

describe('toBraille (Grade 1)', () => {
  it('maps lowercase letters', () => {
    expect(toBraille('abc')).toBe('⠁⠃⠉');
    expect(toBraille('xyz')).toBe('⠭⠽⠵');
  });

  it('prefixes a capital sign for uppercase letters', () => {
    expect(toBraille('A')).toBe('⠠⠁');
    expect(toBraille('Hi')).toBe('⠠⠓⠊');
  });

  it('prefixes a number sign and uses a–j for digits', () => {
    expect(toBraille('1')).toBe('⠼⠁');
    expect(toBraille('10')).toBe('⠼⠁⠚');
    // number sign only once for a run of digits
    expect(toBraille('123')).toBe('⠼⠁⠃⠉');
  });

  it('resets number mode after a space', () => {
    expect(toBraille('1 a')).toBe('⠼⠁ ⠁');
  });

  it('maps common punctuation and preserves spaces', () => {
    expect(toBraille('a, b.')).toBe('⠁⠂ ⠃⠲');
  });

  it('leaves unknown characters out but keeps flow', () => {
    // A tilde has no Grade-1 cell; it is dropped, letters still map.
    expect(toBraille('a~b')).toBe('⠁⠃');
  });
});
