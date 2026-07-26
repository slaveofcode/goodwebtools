import { describe, it, expect } from 'vitest';
import { base64UrlDecode, prettyJson, decodeJwt } from './jwt.lib';

describe('base64UrlDecode', () => {
  it('decodes a standard base64url segment', () => {
    // "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" -> JWT header JSON
    const decoded = base64UrlDecode('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(decoded).toBe('{"alg":"HS256","typ":"JWT"}');
  });

  it('decodes segments containing url-safe - and _ characters', () => {
    // Encodes the bytes 0xFB 0xFF 0xBF which use both - and _ in base64url.
    const decoded = base64UrlDecode('-_-_');
    expect(Array.from(new TextEncoder().encode(decoded)).length).toBeGreaterThan(0);
    // Round-trip: base64url "-_-_" is standard base64 "+/+/"
    const bytes = Uint8Array.from(atob('+/+/'), c => c.charCodeAt(0));
    const expected = new TextDecoder().decode(bytes);
    expect(decoded).toBe(expected);
  });

  it('decodes padding-less segments', () => {
    // "eyJzdWIiOiIxIn0" has no trailing '=' padding.
    expect(base64UrlDecode('eyJzdWIiOiIxIn0')).toBe('{"sub":"1"}');
  });
});

describe('prettyJson', () => {
  it('re-formats JSON with two-space indentation', () => {
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it('throws on invalid JSON', () => {
    expect(() => prettyJson('not json')).toThrow();
  });
});

describe('decodeJwt', () => {
  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.sig';

  it('decodes the header of a known token', () => {
    const { header } = decodeJwt(token);
    expect(header).toContain('HS256');
    expect(header).toContain('JWT');
  });

  it('decodes the payload of a known token', () => {
    const { payload } = decodeJwt(token);
    const parsed = JSON.parse(payload);
    expect(parsed.sub).toBe('1234567890');
    expect(parsed.name).toBe('John Doe');
  });

  it('throws when there are fewer than two segments', () => {
    expect(() => decodeJwt('onlyonesegment')).toThrow(
      'Not a valid JWT — expected at least two dot-separated segments.',
    );
  });

  it('throws on invalid base64 segments', () => {
    // Two segments (passes the split check) but not decodable to valid JSON.
    expect(() => decodeJwt('!!!.@@@')).toThrow();
  });
});
