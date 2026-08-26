import { describe, it, expect } from 'vitest';
import { applyWindowLevel, isUncompressed, rescale, parseFrameCount, clampFrameCount } from './dicom.lib';

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

describe('parseFrameCount', () => {
  it('reads a valid multi-frame count', () => {
    expect(parseFrameCount('96')).toBe(96);
    expect(parseFrameCount(' 12 ')).toBe(12);
  });
  it('defaults to a single frame when absent or invalid', () => {
    expect(parseFrameCount(undefined)).toBe(1);
    expect(parseFrameCount(null)).toBe(1);
    expect(parseFrameCount('')).toBe(1);
    expect(parseFrameCount('0')).toBe(1);
    expect(parseFrameCount('-4')).toBe(1);
    expect(parseFrameCount('abc')).toBe(1);
  });
});

describe('clampFrameCount', () => {
  it('keeps the declared count when the pixel data is large enough', () => {
    // 96 frames of a 128×128 16-bit image = 96 × 32768 bytes.
    expect(clampFrameCount(96, 96 * 128 * 128 * 2, 128 * 128 * 2)).toBe(96);
  });
  it('caps a header that claims more frames than the data holds', () => {
    expect(clampFrameCount(96, 3 * 128 * 128 * 2, 128 * 128 * 2)).toBe(3);
  });
  it('never returns less than one frame', () => {
    expect(clampFrameCount(10, 0, 4096)).toBe(1);
    expect(clampFrameCount(1, 4096, 0)).toBe(1);
  });
});
