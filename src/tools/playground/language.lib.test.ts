import { describe, it, expect } from 'vitest';
import { extensionToLanguage } from './language.lib';

describe('extensionToLanguage', () => {
  it('maps known extensions', () => {
    expect(extensionToLanguage('app.ts')).toBe('typescript');
    expect(extensionToLanguage('data.json')).toBe('json');
    expect(extensionToLanguage('notes.md')).toBe('markdown');
    expect(extensionToLanguage('query.sql')).toBe('sql');
    expect(extensionToLanguage('main.py')).toBe('python');
    expect(extensionToLanguage('style.css')).toBe('css');
  });

  it('is case-insensitive', () => {
    expect(extensionToLanguage('APP.TS')).toBe('typescript');
  });

  it('handles dotted names by using the last segment', () => {
    expect(extensionToLanguage('archive.tar.json')).toBe('json');
  });

  it('falls back to plaintext for unknown or missing extensions', () => {
    expect(extensionToLanguage('README')).toBe('plaintext');
    expect(extensionToLanguage('weird.xyz')).toBe('plaintext');
  });
});
