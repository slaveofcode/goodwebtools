import { describe, it, expect } from 'vitest';
import {
  CHUNK_SIZE,
  chunkCount,
  chunkRange,
  formatBytes,
  percent,
  encodeMeta,
  decodeMeta,
} from './file-transfer.lib';

describe('chunkCount', () => {
  it('handles exact multiples, remainders and zero', () => {
    expect(chunkCount(0)).toBe(0);
    expect(chunkCount(CHUNK_SIZE)).toBe(1);
    expect(chunkCount(CHUNK_SIZE + 1)).toBe(2);
    expect(chunkCount(CHUNK_SIZE * 3)).toBe(3);
  });
  it('supports a custom chunk size', () => {
    expect(chunkCount(10, 4)).toBe(3);
  });
});

describe('chunkRange', () => {
  it('returns [start,end] clamped to the file size', () => {
    expect(chunkRange(0, 10, 4)).toEqual([0, 4]);
    expect(chunkRange(1, 10, 4)).toEqual([4, 8]);
    expect(chunkRange(2, 10, 4)).toEqual([8, 10]); // last chunk clamps
  });
});

describe('percent', () => {
  it('computes a clamped 0..100 integer', () => {
    expect(percent(0, 100)).toBe(0);
    expect(percent(50, 100)).toBe(50);
    expect(percent(100, 100)).toBe(100);
    expect(percent(5, 0)).toBe(0); // avoid divide-by-zero
    expect(percent(200, 100)).toBe(100); // clamp
  });
});

describe('formatBytes', () => {
  it('formats B / KB / MB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('encodeMeta / decodeMeta', () => {
  it('round-trips a transfer meta message', () => {
    const meta = { name: 'a.png', size: 1234, mime: 'image/png' };
    const decoded = decodeMeta(encodeMeta(meta));
    expect(decoded).toEqual(meta);
  });
  it('rejects malformed control messages', () => {
    expect(decodeMeta('not json')).toBeNull();
    expect(decodeMeta(JSON.stringify({ kind: 'nope' }))).toBeNull();
    expect(decodeMeta(JSON.stringify({ kind: 'meta', name: 'x' }))).toBeNull(); // missing size
  });
});
