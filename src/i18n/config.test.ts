import { describe, it, expect } from 'vitest';
import { localizePath, withSlash, stripLocale } from './config';

describe('localized paths', () => {
  it('links pages with their trailing slash, so no link costs a redirect', () => {
    expect(localizePath('/tools/json-format', 'en')).toBe('/tools/json-format/');
    expect(localizePath('/tools/json-format', 'id')).toBe('/id/tools/json-format/');
    expect(localizePath('/', 'en')).toBe('/');
    expect(localizePath('/', 'id')).toBe('/id/');
    expect(localizePath('/about/', 'id')).toBe('/id/about/');
  });
  it('leaves files, queries and hashes alone', () => {
    expect(withSlash('/tools-index.json')).toBe('/tools-index.json');
    expect(withSlash('/ask-agent?q=hi')).toBe('/ask-agent/?q=hi');
    expect(withSlash('/tools/x#top')).toBe('/tools/x/#top');
    expect(withSlash('/tools/x/?a=1')).toBe('/tools/x/?a=1');
  });
  it('still strips a locale prefix', () => {
    expect(stripLocale('/id/tools/x/')).toBe('/tools/x/');
    expect(stripLocale('/id/')).toBe('/');
  });
});
