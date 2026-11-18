import { describe, it, expect } from 'vitest';
import { audioCopyTarget, outputExtFor } from './mb-media.lib';

describe('audioCopyTarget — keep the audio as is, in a container that holds it', () => {
  it.each([
    ['aac', 'm4a', 'mp4'],
    ['opus', 'ogg', 'ogg'],
    ['vorbis', 'ogg', 'ogg'],
    ['mp3', 'mp3', 'mp3'],
    ['flac', 'flac', 'flac'],
    ['pcm-s16', 'wav', 'wav'],
    ['pcm-f32', 'wav', 'wav'],
  ])('%s → .%s', (codec, ext, format) => {
    expect(audioCopyTarget(codec)).toEqual({ ext, format });
  });
  it('has no lossless target for codecs we cannot write', () => {
    expect(audioCopyTarget('ac3')).toBeNull();
  });
});

describe('outputExtFor — trim keeps the input container when it can be written', () => {
  it.each([
    ['mp4', 'mp4'], ['MOV', 'mov'], ['m4v', 'mp4'], ['webm', 'webm'], ['mkv', 'mkv'],
    ['mp3', 'mp3'], ['wav', 'wav'], ['ogg', 'ogg'], ['opus', 'ogg'], ['flac', 'flac'],
    ['m4a', 'm4a'], ['ts', 'mp4'], ['aac', 'm4a'],
  ])('%s → %s', (input, out) => {
    expect(outputExtFor(input)).toBe(out);
  });
});

import { qualityFromCrf } from './mb-media.lib';

describe('qualityFromCrf — the converter quality slider as a hardware quality preset', () => {
  it.each([[18, 'high'], [20, 'high'], [21, 'medium'], [28, 'medium'], [29, 'low'], [40, 'low']])('CRF %s → %s', (crf, q) => {
    expect(qualityFromCrf(crf)).toBe(q);
  });
});

import { lostTracks } from './mb-media.lib';

describe('lostTracks — a real audio/video track mediabunny would silently drop', () => {
  it('flags tracks the browser cannot decode or encode', () => {
    expect(lostTracks([{ reason: 'undecodable_source_codec', track: { type: 'video' } }])).toEqual(['video: undecodable_source_codec']);
    expect(lostTracks([{ reason: 'no_encodable_target_codec', track: { type: 'audio' } }])).toEqual(['audio: no_encodable_target_codec']);
  });
  it('ignores tracks we dropped on purpose, extra tracks, and non-media tracks', () => {
    expect(lostTracks([
      { reason: 'discarded_by_user', track: { type: 'video' } },
      { reason: 'max_track_count_of_type_reached', track: { type: 'audio' } },
      { reason: 'unknown_source_codec', track: { type: 'subtitle' } },
    ])).toEqual([]);
  });
});
