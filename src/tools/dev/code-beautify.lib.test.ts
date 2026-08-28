import { describe, it, expect } from 'vitest';
import { beautify } from './code-beautify.lib';

describe('beautify', () => {
  it('formats JavaScript', async () => {
    expect(await beautify('const x=1', 'js')).toBe('const x = 1;\n');
  });
  it('formats CSS', async () => {
    expect(await beautify('a{color:red}', 'css')).toBe('a {\n  color: red;\n}\n');
  });
  it('formats JSON', async () => {
    expect(await beautify('{"a":1,"b":2}', 'json')).toBe('{ "a": 1, "b": 2 }\n');
  });
  it('rejects invalid syntax', async () => {
    await expect(beautify('const = ', 'js')).rejects.toThrow();
  });
});
