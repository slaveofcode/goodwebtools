import { describe, it, expect } from 'vitest';
import { scaleToWidth, scaleToHeight, formatBytes } from './canvas.lib';

describe('scaleToWidth', () => {
  it('preserves aspect ratio when scaling by width', () => {
    expect(scaleToWidth(1000, 500, 400)).toBe(200);
    expect(scaleToWidth(4000, 3000, 800)).toBe(600);
  });
  it('rounds to the nearest pixel and never returns 0', () => {
    expect(scaleToWidth(3, 2, 1)).toBe(1);
  });
  it('handles a zero source width', () => {
    expect(scaleToWidth(0, 500, 400)).toBe(0);
  });
});

describe('scaleToHeight', () => {
  it('preserves aspect ratio when scaling by height', () => {
    expect(scaleToHeight(1000, 500, 250)).toBe(500);
    expect(scaleToHeight(4000, 3000, 600)).toBe(800);
  });
  it('handles a zero source height', () => {
    expect(scaleToHeight(1000, 0, 250)).toBe(0);
  });
});

describe('formatBytes', () => {
  it('formats bytes, KB, MB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(20 * 1024 * 1024)).toBe('20 MB');
  });
});
