import { describe, it, expect } from 'vitest';
import { mimeFor, pixelRatioFor } from './diagram-image.lib';

describe('mimeFor', () => {
  it('maps each format to its MIME type', () => {
    expect(mimeFor('png')).toBe('image/png');
    expect(mimeFor('jpeg')).toBe('image/jpeg');
    expect(mimeFor('webp')).toBe('image/webp');
    expect(mimeFor('svg')).toBe('image/svg+xml');
  });
});

describe('pixelRatioFor', () => {
  it('clamps scale into 1..3', () => {
    expect(pixelRatioFor(2)).toBe(2);
    expect(pixelRatioFor(0)).toBe(1);
    expect(pixelRatioFor(9)).toBe(3);
  });
});
