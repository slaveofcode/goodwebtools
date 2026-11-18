import { describe, it, expect } from 'vitest';
import { chooseEngine, type MediaJob } from './engine.lib';
import type { EncodeCaps } from '@/services/media/mediabunny.service';

const caps = (video: string[], audio: string[]): EncodeCaps => ({
  video: new Set(video) as EncodeCaps['video'],
  audio: new Set(audio) as EncodeCaps['audio'],
  nativeAudio: new Set(audio),
});
const full = caps(['avc', 'vp9'], ['aac', 'opus', 'mp3']);
const compress: MediaJob = { kind: 'compress-video', inputExt: 'mp4', needVideo: 'avc', needAudio: 'aac' };

describe('chooseEngine', () => {
  it.each<[string, MediaJob, EncodeCaps | null, string]>([
    ['readable input, encoders available', compress, full, 'mediabunny/ok'],
    ['AVI input', { ...compress, inputExt: 'avi' }, full, 'ffmpeg/container'],
    ['WMV input', { ...compress, inputExt: 'wmv' }, full, 'ffmpeg/container'],
    ['FLV input', { ...compress, inputExt: 'flv' }, full, 'ffmpeg/container'],
    ['no H.264 encoder', compress, caps(['vp9'], ['aac']), 'ffmpeg/video-codec'],
    ['no audio encoder for the wanted codec', { ...compress, needAudio: 'flac' }, full, 'ffmpeg/audio-codec'],
    ['browser without WebCodecs', compress, null, 'ffmpeg/no-webcodecs'],
    ['lossless trim needs no encoder', { kind: 'trim', inputExt: 'mov', needAudio: 'copy' }, caps([], []), 'mediabunny/ok'],
    ['upper-case extension', { ...compress, inputExt: 'MP4' }, full, 'mediabunny/ok'],
    ['input the browser cannot decode', { ...compress, inputDecodable: false }, full, 'ffmpeg/cannot-decode'],
    ['copy job ignores decodability', { kind: 'trim', inputExt: 'mp4', needAudio: 'copy', inputDecodable: false }, full, 'mediabunny/ok'],
    ['no audio wanted', { kind: 'convert-video', inputExt: 'webm', needVideo: 'vp9', needAudio: null }, caps(['vp9'], []), 'mediabunny/ok'],
  ])('%s', (_name, job, c, expected) => {
    const r = chooseEngine(job, c);
    expect(`${r.engine}/${r.reason}`).toBe(expected);
  });
});
