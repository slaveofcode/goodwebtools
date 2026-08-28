import { describe, it, expect } from 'vitest';
import { extractParams, routeQuery, prefillUrl } from './router.lib';

describe('extractParams', () => {
  it('pulls a target size', () => {
    expect(extractParams('compress this to 5MB').size).toEqual({ value: 5, unit: 'MB' });
    expect(extractParams('under 25 mb please').size).toEqual({ value: 25, unit: 'MB' });
  });
  it('pulls a url', () => {
    expect(extractParams('shorten https://example.com/x').url).toBe('https://example.com/x');
  });
  it('pulls quoted text into the text slot', () => {
    expect(extractParams('make a QR for "hello world"').text).toBe('hello world');
  });
  it('pulls a standalone number when there is no size', () => {
    expect(extractParams('roman numeral for 2024').number).toBe(2024);
    expect(extractParams('compress to 5mb').number).toBeUndefined();
  });
});

describe('routeQuery', () => {
  it('routes a compression request to the video compressor', () => {
    const r = routeQuery('make my video smaller');
    expect(r.candidates.length).toBeGreaterThan(0);
    expect(r.candidates.map(c => c.id)).toContain('video-compress');
  });
  it('routes a QR request and normalizes confidence to 1 for the top hit', () => {
    const r = routeQuery('generate a qr code');
    expect(r.candidates[0].confidence).toBe(1);
    expect(r.candidates.map(c => c.id).some(id => id.includes('qr'))).toBe(true);
  });
  it('carries extracted params alongside candidates', () => {
    const r = routeQuery('compress image to 200kb');
    expect(r.params.size).toEqual({ value: 200, unit: 'KB' });
  });
  it('returns no candidates for gibberish', () => {
    expect(routeQuery('zxqwv').candidates).toHaveLength(0);
  });
});

describe('router hardening', () => {
  it('routes synonyms of compress to the compressor', () => {
    // "shrink" should reach a compressor even though the tool copy says "compress".
    const ids = routeQuery('shrink my video').candidates.map(c => c.id);
    expect(ids).toContain('video-compress');
  });

  it('breaks ties by popularity for an intent-clear query', () => {
    expect(routeQuery('generate qr').candidates[0].id).toBe('qr-gen');
  });

  it('extracts the residual (unquoted) payload as text', () => {
    const r = routeQuery('encode base64 AABBCC');
    expect(r.candidates[0].id).toBe('base64');
    expect(r.params.text).toBe('AABBCC');
  });

  it('does not invent text when the query is all intent', () => {
    expect(routeQuery('compress my video to 8mb').params.text).toBeUndefined();
  });
});

describe('prefillUrl', () => {
  it('encodes params as a query string', () => {
    expect(prefillUrl('/tools/video-compress', { size: { value: 5, unit: 'MB' } }))
      .toBe('/tools/video-compress?size=5MB');
    expect(prefillUrl('/tools/x', {})).toBe('/tools/x');
  });
});
