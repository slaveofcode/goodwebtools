import { describe, it, expect } from 'vitest';
import {
  mixToMono,
  segmentsToText,
  formatClock,
  formatSrtTime,
  formatVttTime,
  segmentsToSrt,
  segmentsToVtt,
  type TranscriptSegment,
} from './stt.lib';

describe('mixToMono', () => {
  it('returns the single channel unchanged for mono input', () => {
    const ch = new Float32Array([0.25, 0.5, -0.75]);
    expect(Array.from(mixToMono([ch]))).toEqual([0.25, 0.5, -0.75]);
  });
  it('averages multiple channels sample-wise', () => {
    const l = new Float32Array([1, 0, -1]);
    const r = new Float32Array([1, 1, 1]);
    const mono = mixToMono([l, r]);
    expect(Array.from(mono).map(v => +v.toFixed(3))).toEqual([1, 0.5, 0]);
  });
  it('throws on empty channel list', () => {
    expect(() => mixToMono([])).toThrow();
  });
});

describe('segmentsToText', () => {
  it('trims and space-joins segment text', () => {
    const segs: TranscriptSegment[] = [
      { start: 0, end: 1, text: ' Hello ' },
      { start: 1, end: 2, text: 'world ' },
    ];
    expect(segmentsToText(segs)).toBe('Hello world');
  });
  it('drops empty segments', () => {
    expect(segmentsToText([{ start: 0, end: 1, text: '   ' }])).toBe('');
  });
});

describe('time formatters', () => {
  it('formatClock renders m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(61)).toBe('1:01');
    expect(formatClock(3661)).toBe('61:01');
  });
  it('formatSrtTime renders HH:MM:SS,mmm', () => {
    expect(formatSrtTime(3661.5)).toBe('01:01:01,500');
    expect(formatSrtTime(0)).toBe('00:00:00,000');
  });
  it('formatVttTime renders HH:MM:SS.mmm', () => {
    expect(formatVttTime(3661.5)).toBe('01:01:01.500');
  });
  it('clamps negatives to zero', () => {
    expect(formatSrtTime(-5)).toBe('00:00:00,000');
  });
});

describe('subtitle export', () => {
  const segs: TranscriptSegment[] = [
    { start: 0, end: 2.5, text: 'Hello' },
    { start: 2.5, end: 5, text: 'world' },
  ];
  it('segmentsToSrt numbers cues with the arrow separator', () => {
    const srt = segmentsToSrt(segs);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,500\nHello');
    expect(srt).toContain('2\n00:00:02,500 --> 00:00:05,000\nworld');
  });
  it('segmentsToVtt starts with the WEBVTT header and uses dot millis', () => {
    const vtt = segmentsToVtt(segs);
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('00:00:00.000 --> 00:00:02.500\nHello');
  });
  it('falls back to start when a segment end is missing', () => {
    const open: TranscriptSegment[] = [{ start: 3, end: null as unknown as number, text: 'end' }];
    expect(segmentsToSrt(open)).toContain('00:00:03,000 --> 00:00:03,000');
  });
});
