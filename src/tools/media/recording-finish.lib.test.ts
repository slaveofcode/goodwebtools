import { describe, it, expect } from 'vitest';
import { fixRecording } from './recording-finish.lib';

const orig = new Blob(['original'], { type: 'video/webm' });

describe('fixRecording', () => {
  it('returns the re-packed file when re-packing works', async () => {
    const fixed = new Blob(['fixed!'], { type: 'video/webm' });
    expect(await fixRecording(orig, async () => fixed)).toBe(fixed);
  });
  it('keeps the original when re-packing fails', async () => {
    expect(await fixRecording(orig, async () => { throw new Error('bad'); })).toBe(orig);
  });
  it('keeps the original when re-packing gives an empty file', async () => {
    expect(await fixRecording(orig, async () => new Blob([]))).toBe(orig);
  });
  it('keeps the original when re-packing gives a much smaller file (lost a track)', async () => {
    const big = new Blob([new Uint8Array(10_000)], { type: 'video/webm' });
    expect(await fixRecording(big, async () => new Blob([new Uint8Array(100)]))).toBe(big);
  });
});
