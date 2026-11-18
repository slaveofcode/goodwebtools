import { describe, it, expect } from 'vitest';
import { humanDuration, formatMediaInfo, mediaInfoJson, codecName, type MediaInfo } from './media-info.lib';

const INFO: MediaInfo = {
  fileName: 'clip.mp4', size: 204_800, mime: 'video/mp4', container: 'MP4', durationSec: 3, bitrate: 546_133,
  tracks: [
    { kind: 'video', codec: 'avc', codecString: 'avc1.64001e', language: null, bitrate: 400_000, width: 640, height: 360, displayWidth: 640, displayHeight: 360, rotation: 0, frameRate: 30 },
    { kind: 'audio', codec: 'aac', codecString: 'mp4a.40.2', language: 'eng', bitrate: 96_000, sampleRate: 48000, channels: 2 },
  ],
  tags: { title: 'Test', picture: { mime: 'image/png', data: new Uint8Array(10) } },
};

describe('humanDuration', () => {
  it.each([[3, '0:03.00'], [62.5, '1:02.50'], [3723.5, '1:02:03.50'], [0, '0:00.00']])('%s s → %s', (s, out) => {
    expect(humanDuration(s)).toBe(out);
  });
});

describe('codecName', () => {
  it.each([['avc', 'H.264'], ['hevc', 'H.265 (HEVC)'], ['vp9', 'VP9'], ['aac', 'AAC'], ['pcm-s16', 'PCM 16-bit'], ['weird', 'weird']])('%s → %s', (c, n) => {
    expect(codecName(c)).toBe(n);
  });
});

describe('formatMediaInfo', () => {
  it('lists the file and each track as Key: value lines', () => {
    const text = formatMediaInfo(INFO);
    expect(text).toContain('File: clip.mp4');
    expect(text).toContain('Container: MP4');
    expect(text).toContain('Duration: 0:03.00');
    expect(text).toContain('Video track 1');
    expect(text).toContain('Codec: H.264 (avc1.64001e)');
    expect(text).toContain('Resolution: 640 × 360');
    expect(text).toContain('Frame rate: 30 fps');
    expect(text).toContain('Audio track 1');
    expect(text).toContain('Channels: 2');
    expect(text).toContain('Title: Test');
  });
});

describe('mediaInfoJson', () => {
  it('replaces the cover bytes with their size', () => {
    const j = JSON.parse(mediaInfoJson(INFO));
    expect(j.tags.picture).toEqual({ mime: 'image/png', bytes: 10 });
    expect(j.tracks).toHaveLength(2);
  });
});
