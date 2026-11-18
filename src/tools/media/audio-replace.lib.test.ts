import { describe, it, expect } from 'vitest';
import { audioPlan, replaceTarget } from './audio-replace.lib';

describe('audioPlan', () => {
  it('loops a shorter track to fill the video and cuts at its end', () => {
    expect(audioPlan(2, 3, true)).toEqual({ repeats: 2, cutAtSec: 3 });
    expect(audioPlan(1, 10, true)).toEqual({ repeats: 10, cutAtSec: 10 });
  });
  it('cuts a longer track at the video’s end', () => {
    expect(audioPlan(5, 3, true)).toEqual({ repeats: 1, cutAtSec: 3 });
  });
  it('plays a shorter track once when looping is off', () => {
    expect(audioPlan(2, 3, false)).toEqual({ repeats: 1, cutAtSec: 3 });
  });
  it('copes with an audio file of unknown length', () => {
    expect(audioPlan(0, 3, true)).toEqual({ repeats: 1, cutAtSec: 3 });
  });
});

describe('replaceTarget', () => {
  it.each([
    ['vp9', 'webm', { ext: 'webm', audioCodec: 'opus' }],
    ['av1', 'webm', { ext: 'webm', audioCodec: 'opus' }],
    ['avc', 'mp4', { ext: 'mp4', audioCodec: 'aac' }],
    ['avc', 'MOV', { ext: 'mov', audioCodec: 'aac' }],
    ['hevc', 'mkv', { ext: 'mkv', audioCodec: 'aac' }],
    ['vp9', 'mkv', { ext: 'mkv', audioCodec: 'aac' }],
    ['avc', 'ts', { ext: 'mp4', audioCodec: 'aac' }],
  ] as const)('%s in .%s → %o', (codec, ext, out) => {
    expect(replaceTarget(codec, ext)).toEqual(out);
  });
});

import { ffmpegMuteArgs, ffmpegReplaceArgs } from './audio-replace.lib';

describe('ffmpeg fallback arguments', () => {
  it('drops only the audio and copies the rest', () => {
    expect(ffmpegMuteArgs('mkv')).toEqual(['-i', 'in', '-map', '0', '-map', '-0:a', '-c', 'copy', 'out.mkv']);
  });
  it('loops the new audio before its input and cuts at the video length', () => {
    const a = ffmpegReplaceArgs(true, 3);
    expect(a.slice(0, 6)).toEqual(['-i', 'in', '-stream_loop', '-1', '-i', 'aud']);
    expect(a).toEqual(expect.arrayContaining(['-c:v', 'copy', '-c:a', 'aac', '-t', '3']));
    expect(ffmpegReplaceArgs(false, 3)).not.toContain('-stream_loop');
  });
});

import { createPacer } from './audio-replace.lib';

describe('createPacer — the copied video waits for the (slower) new audio', () => {
  const settled = async (p: Promise<void>) => { let done = false; void p.then(() => { done = true; }); await new Promise(r => setTimeout(r, 0)); return done; };

  it('lets video through while it is within the lead of the audio', async () => {
    const pacer = createPacer(1);
    expect(await settled(pacer.video(0.5))).toBe(true);
  });
  it('holds video that is too far ahead until the audio catches up', async () => {
    const pacer = createPacer(1);
    const wait = pacer.video(5);
    expect(await settled(wait)).toBe(false);
    pacer.audio(3.9);
    expect(await settled(wait)).toBe(false);
    pacer.audio(4.2);
    expect(await settled(wait)).toBe(true);
  });
  it('lets everything through once the audio has ended', async () => {
    const pacer = createPacer(1);
    const wait = pacer.video(60);
    pacer.audioDone();
    expect(await settled(wait)).toBe(true);
    expect(await settled(pacer.video(120))).toBe(true);
  });
});
