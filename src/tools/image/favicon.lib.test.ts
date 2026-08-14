import { describe, it, expect } from 'vitest';
import { buildManifest, htmlSnippet, FAVICON_SIZES } from './favicon.lib';

describe('buildManifest', () => {
  it('is valid JSON referencing the chrome icons', () => {
    const m = JSON.parse(buildManifest('My Site'));
    expect(m.name).toBe('My Site');
    expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512']);
    expect(m.display).toBe('standalone');
  });
});

describe('htmlSnippet', () => {
  it('includes the ico, png, apple-touch and manifest links', () => {
    const s = htmlSnippet();
    expect(s).toContain('favicon.ico');
    expect(s).toContain('apple-touch-icon');
    expect(s).toContain('site.webmanifest');
  });
});

describe('FAVICON_SIZES', () => {
  it('covers the standard sizes', () => {
    expect(FAVICON_SIZES.map(f => f.size)).toEqual([16, 32, 48, 180, 192, 512]);
  });
});
