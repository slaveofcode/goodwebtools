import { describe, it, expect } from 'vitest';
import { cleanUrl, cleanUrls, isTrackingParam } from './url-clean.lib';

describe('isTrackingParam', () => {
  it('matches utm_* and known trackers', () => {
    expect(isTrackingParam('utm_source')).toBe(true);
    expect(isTrackingParam('UTM_Campaign')).toBe(true);
    expect(isTrackingParam('fbclid')).toBe(true);
    expect(isTrackingParam('gclid')).toBe(true);
    expect(isTrackingParam('si')).toBe(true);
  });
  it('leaves ordinary params alone', () => {
    expect(isTrackingParam('id')).toBe(false);
    expect(isTrackingParam('q')).toBe(false);
    expect(isTrackingParam('page')).toBe(false);
  });
});

describe('cleanUrl', () => {
  it('removes tracking params and keeps the rest in order', () => {
    const r = cleanUrl('https://shop.example.com/p?utm_source=fb&id=5&fbclid=abc&color=red');
    expect(r.clean).toBe('https://shop.example.com/p?id=5&color=red');
    expect(r.removed.sort()).toEqual(['fbclid', 'utm_source']);
    expect(r.valid).toBe(true);
  });

  it('drops the query string entirely when only trackers remain', () => {
    const r = cleanUrl('https://example.com/article?utm_medium=email&utm_campaign=x');
    expect(r.clean).toBe('https://example.com/article');
    expect(r.removed).toHaveLength(2);
  });

  it('preserves the hash fragment', () => {
    const r = cleanUrl('https://example.com/p?gclid=1#section-2');
    expect(r.clean).toBe('https://example.com/p#section-2');
  });

  it('leaves a clean URL untouched', () => {
    const r = cleanUrl('https://example.com/p?id=5');
    expect(r.clean).toBe('https://example.com/p?id=5');
    expect(r.removed).toEqual([]);
  });

  it('flags an unparseable string as invalid', () => {
    const r = cleanUrl('not a url');
    expect(r.valid).toBe(false);
    expect(r.removed).toEqual([]);
  });
});

describe('cleanUrls (bulk)', () => {
  it('cleans each non-empty line', () => {
    const out = cleanUrls('https://a.com/?utm_source=x\n\nhttps://b.com/?id=1&gclid=z');
    expect(out).toHaveLength(2);
    expect(out[0].clean).toBe('https://a.com/');
    expect(out[1].clean).toBe('https://b.com/?id=1');
  });
});
