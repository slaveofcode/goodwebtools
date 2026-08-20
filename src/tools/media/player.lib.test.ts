import { describe, it, expect } from 'vitest';
import {
  extOf, isSupported, displayName, formatTime, nextIndex, prevIndex,
  loopSeek, resumeKey, shouldResume, stepSpeed, SPEEDS, type Track,
} from './player.lib';

describe('file helpers', () => {
  it('extOf lowercases the extension', () => {
    expect(extOf('Song.MP3')).toBe('mp3');
    expect(extOf('noext')).toBe('noext');
  });

  it('isSupported distinguishes audio and video', () => {
    expect(isSupported('a.mp3', 'audio')).toBe(true);
    expect(isSupported('a.wav', 'audio')).toBe(true);
    expect(isSupported('a.flac', 'audio')).toBe(true);
    expect(isSupported('a.mp4', 'video')).toBe(true);
    expect(isSupported('a.webm', 'video')).toBe(true);
    // Common containers browsers can't decode.
    expect(isSupported('a.mkv', 'video')).toBe(false);
    expect(isSupported('a.avi', 'video')).toBe(false);
    expect(isSupported('a.mp4', 'audio')).toBe(false);
  });

  it('displayName drops the extension', () => {
    expect(displayName('My Song.mp3')).toBe('My Song');
    expect(displayName('noext')).toBe('noext');
    expect(displayName('.hidden')).toBe('.hidden');
  });
});

describe('formatTime', () => {
  it.each([
    [0, '0:00'], [5, '0:05'], [65, '1:05'], [600, '10:00'],
    [3600, '1:00:00'], [3725, '1:02:05'],
  ])('%i s → %s', (secs, out) => expect(formatTime(secs)).toBe(out));

  it('handles NaN/Infinity/negatives', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
});

describe('playlist navigation', () => {
  it('advances and stops at the end when repeat is off', () => {
    expect(nextIndex(0, 3, 'off', false)).toBe(1);
    expect(nextIndex(2, 3, 'off', false)).toBeNull();
  });

  it('wraps when repeat is all', () => {
    expect(nextIndex(2, 3, 'all', false)).toBe(0);
  });

  it('repeat one stays on the current track', () => {
    expect(nextIndex(1, 3, 'one', false)).toBe(1);
    expect(nextIndex(1, 3, 'one', true)).toBe(1);
  });

  it('shuffle never immediately repeats the current track', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.99]) {
      expect(nextIndex(2, 5, 'off', true, () => r)).not.toBe(2);
    }
  });

  it('shuffle of a single track only repeats when repeat is all', () => {
    expect(nextIndex(0, 1, 'all', true, () => 0)).toBe(0);
    expect(nextIndex(0, 1, 'off', true, () => 0)).toBeNull();
  });

  it('handles an empty playlist', () => {
    expect(nextIndex(0, 0, 'all', false)).toBeNull();
    expect(prevIndex(0, 0)).toBe(0);
  });

  it('prevIndex wraps backwards', () => {
    expect(prevIndex(0, 3)).toBe(2);
    expect(prevIndex(2, 3)).toBe(1);
  });
});

describe('A–B loop', () => {
  it('no jump when the loop is incomplete', () => {
    expect(loopSeek(10, { a: null, b: null })).toBeNull();
    expect(loopSeek(10, { a: 5, b: null })).toBeNull();
  });

  it('jumps back to A past B', () => {
    expect(loopSeek(30, { a: 10, b: 20 })).toBe(10);
  });

  it('jumps to A when seeking before the loop', () => {
    expect(loopSeek(2, { a: 10, b: 20 })).toBe(10);
  });

  it('stays put inside the loop', () => {
    expect(loopSeek(15, { a: 10, b: 20 })).toBeNull();
  });

  it('ignores an inverted loop', () => {
    expect(loopSeek(15, { a: 20, b: 10 })).toBeNull();
  });
});

describe('resume', () => {
  const track: Track = { id: '1', name: 'movie.mp4', size: 12345, type: 'video/mp4' };

  it('key combines name and size', () => {
    expect(resumeKey(track)).toBe('movie.mp4:12345');
  });

  it('offers resume only in the middle of a file', () => {
    expect(shouldResume(300, 600)).toBe(true);
    expect(shouldResume(2, 600)).toBe(false);      // barely started
    expect(shouldResume(595, 600)).toBe(false);    // basically finished
    expect(shouldResume(300, NaN)).toBe(false);
  });
});

describe('speed', () => {
  it('steps through the preset speeds', () => {
    expect(stepSpeed(1, 1)).toBe(1.25);
    expect(stepSpeed(1, -1)).toBe(0.75);
  });

  it('clamps at the ends', () => {
    expect(stepSpeed(SPEEDS[0], -1)).toBe(SPEEDS[0]);
    expect(stepSpeed(SPEEDS[SPEEDS.length - 1], 1)).toBe(SPEEDS[SPEEDS.length - 1]);
  });

  it('recovers from an off-list speed', () => {
    expect(stepSpeed(1.1, 1)).toBe(1.25);
  });
});
