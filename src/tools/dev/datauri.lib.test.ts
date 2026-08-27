import { describe, it, expect } from 'vitest';
import { parseDataUri, decodedSize, toCssBackground, toImgTag } from './datauri.lib';

describe('decodedSize', () => {
  it.each([
    ['TWFu', 3],      // "Man"
    ['TWE=', 2],      // "Ma"
    ['TQ==', 1],      // "M"
    ['', 0],
  ])('%s → %d bytes', (b64, size) => {
    expect(decodedSize(b64)).toBe(size);
  });
});

describe('parseDataUri', () => {
  it('splits mime and payload', () => {
    const r = parseDataUri('data:image/png;base64,TWFu');
    expect(r).toEqual({ mime: 'image/png', base64: 'TWFu', bytes: 3 });
  });
  it('returns null for non-base64 data URIs', () => {
    expect(parseDataUri('data:text/plain,hello')).toBeNull();
    expect(parseDataUri('https://example.com/a.png')).toBeNull();
  });
});

describe('wrappers', () => {
  it('builds a CSS background', () => {
    expect(toCssBackground('data:image/png;base64,AAAA')).toBe('background-image: url("data:image/png;base64,AAAA");');
  });
  it('builds an img tag', () => {
    expect(toImgTag('data:image/png;base64,AAAA', 'logo')).toBe('<img src="data:image/png;base64,AAAA" alt="logo" />');
  });
});
