import { describe, it, expect } from 'vitest';
import { applyWindowLevel, isUncompressed, rescale } from './dicom.lib';

describe('rescale', () => {
  it('applies slope and intercept', () => {
    expect(rescale(100, 1, -1024)).toBe(-924);
    expect(rescale(50, 2, 0)).toBe(100);
  });
});

describe('applyWindowLevel', () => {
  const c = 128, w = 256;
  it('maps the window ends to 0 and 255', () => {
    expect(applyWindowLevel(0, c, w, false)).toBe(0);
    expect(applyWindowLevel(255, c, w, false)).toBe(255);
  });
  it('maps the centre near mid-grey', () => {
    expect(applyWindowLevel(128, c, w, false)).toBeGreaterThanOrEqual(127);
    expect(applyWindowLevel(128, c, w, false)).toBeLessThanOrEqual(129);
  });
  it('clamps values outside the window', () => {
    expect(applyWindowLevel(-50, c, w, false)).toBe(0);
    expect(applyWindowLevel(400, c, w, false)).toBe(255);
  });
  it('inverts for MONOCHROME1', () => {
    expect(applyWindowLevel(0, c, w, true)).toBe(255);
    expect(applyWindowLevel(255, c, w, true)).toBe(0);
  });
});

describe('isUncompressed', () => {
  it('accepts the implicit/explicit little- and big-endian syntaxes', () => {
    expect(isUncompressed('1.2.840.10008.1.2')).toBe(true);
    expect(isUncompressed('1.2.840.10008.1.2.1')).toBe(true);
    expect(isUncompressed('1.2.840.10008.1.2.2')).toBe(true);
  });
  it('rejects compressed transfer syntaxes', () => {
    expect(isUncompressed('1.2.840.10008.1.2.4.50')).toBe(false); // JPEG baseline
    expect(isUncompressed('1.2.840.10008.1.2.4.90')).toBe(false); // JPEG 2000
    expect(isUncompressed('1.2.840.10008.1.2.5')).toBe(false); // RLE
    expect(isUncompressed('')).toBe(false);
  });
});
