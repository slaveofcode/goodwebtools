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
