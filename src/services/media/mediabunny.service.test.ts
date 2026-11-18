import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const native: Record<string, boolean> = {};
const canEncode = vi.fn(async (codec: string) => !!native[codec]);
const registerAacEncoder = vi.fn();
const registerMp3Encoder = vi.fn();

vi.mock('mediabunny', () => ({ canEncode }));
vi.mock('@mediabunny/aac-encoder', () => ({ registerAacEncoder }));
vi.mock('@mediabunny/mp3-encoder', () => ({ registerMp3Encoder }));

import { getEncodeCaps, ensureAudioEncoder, __resetMediabunnyForTests } from './mediabunny.service';

describe('mediabunny service', () => {
  beforeEach(() => {
    for (const k of Object.keys(native)) delete native[k];
    canEncode.mockClear(); registerAacEncoder.mockClear(); registerMp3Encoder.mockClear();
    __resetMediabunnyForTests();
    vi.stubGlobal('VideoEncoder', class {});
    vi.stubGlobal('AudioEncoder', class {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('probes each codec once and caches the result', async () => {
    Object.assign(native, { avc: true, opus: true });
    await getEncodeCaps();
    const calls = canEncode.mock.calls.length;
    await getEncodeCaps();
    expect(canEncode.mock.calls.length).toBe(calls);
    expect(new Set(canEncode.mock.calls.map(c => c[0])).size).toBe(calls);
  });

  it('counts AAC and MP3 as available through the add-ons, but not as native', async () => {
    Object.assign(native, { avc: true, aac: false, opus: true });
    const caps = await getEncodeCaps();
    expect(caps?.video.has('avc')).toBe(true);
    expect(caps?.video.has('vp9')).toBe(false);
    expect(caps?.audio.has('aac')).toBe(true);
    expect(caps?.audio.has('mp3')).toBe(true);
    expect(caps?.nativeAudio.has('aac')).toBe(false);
    expect(caps?.nativeAudio.has('opus')).toBe(true);
  });

  it('reports no capabilities when the browser has no WebCodecs', async () => {
    vi.stubGlobal('VideoEncoder', undefined);
    expect(await getEncodeCaps()).toBeNull();
    expect(canEncode).not.toHaveBeenCalled();
  });

  it('registers the AAC add-on once, and only when AAC is not native', async () => {
    Object.assign(native, { aac: false });
    await ensureAudioEncoder('aac');
    await ensureAudioEncoder('aac');
    expect(registerAacEncoder).toHaveBeenCalledTimes(1);

    __resetMediabunnyForTests();
    registerAacEncoder.mockClear();
    Object.assign(native, { aac: true });
    await ensureAudioEncoder('aac');
    expect(registerAacEncoder).not.toHaveBeenCalled();
  });

  it('registers the MP3 add-on when MP3 is not native', async () => {
    await ensureAudioEncoder('mp3');
    expect(registerMp3Encoder).toHaveBeenCalledTimes(1);
  });
});
