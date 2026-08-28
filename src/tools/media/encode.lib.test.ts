import { describe, it, expect, vi, beforeEach } from 'vitest';

// A fake ffmpeg that records exec() argument lists and returns a fixed payload.
const execCalls: string[][] = [];
let readPayload: Uint8Array = new Uint8Array([1, 2, 3]);
const fakeFFmpeg = {
  on: vi.fn(), off: vi.fn(),
  writeFile: vi.fn(async () => {}),
  exec: vi.fn(async (args: string[]) => { execCalls.push(args); }),
  readFile: vi.fn(async () => readPayload),
};
vi.mock('@/services/ffmpeg.service', () => ({
  loadFFmpeg: async () => fakeFFmpeg,
  fileToU8: async () => new Uint8Array([9]),
}));

import { videoCompressArgs, computeAudioKbps, compressVideo, compressAudio, trimMedia, extractAudio, videoConvertArgs, convertVideo, videoToGif, VIDEO_FORMATS } from './encode.lib';

beforeEach(() => { execCalls.length = 0; readPayload = new Uint8Array([1, 2, 3]); vi.clearAllMocks(); });

describe('videoCompressArgs', () => {
  it('emits a constrained x264 pass with scaling and aac audio', () => {
    const a = videoCompressArgs(800, 128, 720);
    expect(a).toContain('libx264');
    expect(a).toEqual(expect.arrayContaining(['-b:v', '800k', '-maxrate', '800k', '-bufsize', '1600k']));
    expect(a).toEqual(expect.arrayContaining(['-vf', "scale='min(720,iw)':-2:flags=lanczos"]));
    expect(a).toEqual(expect.arrayContaining(['-c:a', 'aac', '-b:a', '128k']));
    expect(a[a.length - 1]).toBe('out.mp4');
  });
  it('drops audio (-an) and skips scaling when audioKbps=0 and maxWidth=0', () => {
    const a = videoCompressArgs(500, 0, 0);
    expect(a).toContain('-an');
    expect(a).not.toContain('-vf');
    expect(a).not.toContain('aac');
  });
});

describe('computeAudioKbps', () => {
  it('solves bitrate from target size and duration', () => {
    // 1,000,000 bytes over 100s → 8,000,000 bits / 100 / 1000 = 80 kbps
    expect(computeAudioKbps(1_000_000, 100)).toBe(80);
  });
  it('clamps to [32, 320]', () => {
    expect(computeAudioKbps(10, 1000)).toBe(32);
    expect(computeAudioKbps(10_000_000, 1)).toBe(320);
  });
  it('throws on non-positive duration', () => {
    expect(() => computeAudioKbps(1000, 0)).toThrow();
  });
});

describe('compressVideo', () => {
  it('plans the bitrate and runs one x264 exec, returning an mp4 blob', async () => {
    const blob = await compressVideo(new Blob([new Uint8Array([0])]), { targetBytes: 8 * 1024 * 1024, durationSec: 60, maxWidth: 720 });
    expect(execCalls).toHaveLength(1);
    expect(execCalls[0]).toContain('libx264');
    expect(execCalls[0][execCalls[0].length - 1]).toBe('out.mp4');
    expect(blob.type).toBe('video/mp4');
  });
});

describe('compressAudio', () => {
  it('re-encodes to mp3 at the computed bitrate', async () => {
    const blob = await compressAudio(new Blob([new Uint8Array([0])]), { targetBytes: 1_000_000, durationSec: 100 });
    expect(execCalls[0]).toEqual(['-i', 'in', '-c:a', 'libmp3lame', '-b:a', '80k', 'out.mp3']);
    expect(blob.type).toBe('audio/mpeg');
  });
});

describe('videoConvertArgs', () => {
  const webm = VIDEO_FORMATS.find(f => f.id === 'webm')!;
  const mp4 = VIDEO_FORMATS.find(f => f.id === 'mp4')!;
  it('emits vp9/opus for webm with crf and scale', () => {
    const a = videoConvertArgs(webm, 30, 640, false);
    expect(a).toEqual(expect.arrayContaining(['-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-row-mt', '1']));
    expect(a).toEqual(expect.arrayContaining(['-vf', 'scale=640:-2:flags=lanczos', '-c:a', 'libopus']));
    expect(a[a.length - 1]).toBe('out.webm');
  });
  it('emits x264 faststart for mp4 and honors mute + trim', () => {
    const a = videoConvertArgs(mp4, 23, 0, true, 5, 10);
    expect(a.slice(0, 4)).toEqual(['-ss', '5', '-t', '10']);
    expect(a).toEqual(expect.arrayContaining(['-c:v', 'libx264', '-movflags', '+faststart', '-an']));
    expect(a).not.toContain('aac');
  });
});

describe('convertVideo', () => {
  it('runs one transcode and returns the target mime', async () => {
    const blob = await convertVideo(new Blob([new Uint8Array([0])]), { format: 'webm', crf: 28 });
    expect(execCalls[0][execCalls[0].length - 1]).toBe('out.webm');
    expect(blob.type).toBe('video/webm');
  });
  it('throws on an unsupported format', async () => {
    // @ts-expect-error deliberately invalid format
    await expect(convertVideo(new Blob([new Uint8Array([0])]), { format: 'avi' })).rejects.toThrow();
  });
});

describe('videoToGif', () => {
  it('runs palettegen then paletteuse and returns image/gif', async () => {
    const blob = await videoToGif(new Blob([new Uint8Array([0])]), { fps: 15, width: 320 });
    expect(execCalls).toHaveLength(2);
    expect(execCalls[0]).toEqual(expect.arrayContaining(['-vf', 'fps=15,scale=320:-1:flags=lanczos,palettegen', 'palette.png']));
    expect(execCalls[1]).toEqual(expect.arrayContaining(['-i', 'palette.png', 'out.gif']));
    expect(blob.type).toBe('image/gif');
  });
});

describe('extractAudio', () => {
  it('drops video (-vn) and encodes mp3, returning an audio blob', async () => {
    const blob = await extractAudio(new Blob([new Uint8Array([0])]));
    expect(execCalls[0]).toEqual(['-i', 'in', '-vn', '-c:a', 'libmp3lame', '-q:a', '2', 'out.mp3']);
    expect(blob.type).toBe('audio/mpeg');
  });
});

describe('trimMedia', () => {
  it('fast path stream-copies with -ss/-to and returns the source ext', async () => {
    const r = await trimMedia(new Blob([new Uint8Array([0])]), { startSec: 5, endSec: 12, durationSec: 60, isVideo: true, ext: 'mp4' });
    expect(execCalls[0]).toEqual(['-ss', '5', '-to', '12', '-i', 'in', '-c', 'copy', 'out.mp4']);
    expect(r.ext).toBe('mp4');
  });
  it('falls back to a re-encode when the stream copy yields an empty file', async () => {
    readPayload = new Uint8Array([]); // copy probe reads empty → fallback
    // second read (after reencode) must be non-empty, so flip the payload after first exec
    fakeFFmpeg.readFile.mockImplementationOnce(async () => new Uint8Array([]))
      .mockImplementation(async () => new Uint8Array([7, 7]));
    const r = await trimMedia(new Blob([new Uint8Array([0])]), { startSec: 0, endSec: 3, durationSec: 30, isVideo: false });
    // first exec = copy attempt, second exec = libmp3lame re-encode
    expect(execCalls[0]).toContain('copy');
    expect(execCalls[1]).toEqual(expect.arrayContaining(['-c:a', 'libmp3lame', '-q:a', '2']));
    expect(r.ext).toBe('mp3');
  });
  it('re-encodes directly when fast=false', async () => {
    await trimMedia(new Blob([new Uint8Array([0])]), { startSec: 1, endSec: 4, durationSec: 30, isVideo: true, fast: false });
    expect(execCalls).toHaveLength(1);
    expect(execCalls[0]).toEqual(expect.arrayContaining(['-c:v', 'libx264', '-c:a', 'aac']));
  });
});
