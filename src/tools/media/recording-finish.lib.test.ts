import { describe, it, expect, vi, beforeEach } from 'vitest';

const mb = vi.hoisted(() => ({ mbRemux: vi.fn(), mbHasDuration: vi.fn() }));
vi.mock('./mb-media.lib', () => mb);

import { fixRecording, finishRecording, MAX_REPACK_BYTES } from './recording-finish.lib';

beforeEach(() => { mb.mbRemux.mockReset(); mb.mbHasDuration.mockReset(); });

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

describe('finishRecording', () => {
  const webm = (bytes = 1000) => new Blob([new Uint8Array(bytes)], { type: 'video/webm' });

  it('re-packs a recording without a duration', async () => {
    const fixed = webm(900);
    mb.mbHasDuration.mockResolvedValue(false);
    mb.mbRemux.mockResolvedValue(fixed);
    expect(await finishRecording(webm())).toBe(fixed);
  });
  it('leaves a recording that already has a duration alone (no second copy)', async () => {
    const rec = webm();
    mb.mbHasDuration.mockResolvedValue(true);
    expect(await finishRecording(rec)).toBe(rec);
    expect(mb.mbRemux).not.toHaveBeenCalled();
  });
  it('leaves a very large recording alone (memory)', async () => {
    const huge = { size: MAX_REPACK_BYTES + 1, type: 'video/webm' } as Blob;
    expect(await finishRecording(huge)).toBe(huge);
    expect(mb.mbHasDuration).not.toHaveBeenCalled();
    expect(mb.mbRemux).not.toHaveBeenCalled();
  });
  it('passes other formats through', async () => {
    const mp4 = new Blob(['x'], { type: 'video/mp4' });
    expect(await finishRecording(mp4)).toBe(mp4);
    expect(mb.mbRemux).not.toHaveBeenCalled();
  });
});

