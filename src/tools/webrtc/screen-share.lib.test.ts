import { describe, it, expect } from 'vitest';
import { videoCodecFromSdp, screenScaleFor } from './screen-share.lib';

const sdp = (pts: string, maps: string[]) =>
  ['v=0', 'm=audio 9 UDP/TLS/RTP/SAVPF 111', 'a=rtpmap:111 opus/48000/2', `m=video 9 UDP/TLS/RTP/SAVPF ${pts}`, ...maps].join('\r\n');

describe('videoCodecFromSdp', () => {
  it('reads the first (preferred) video codec', () => {
    expect(videoCodecFromSdp(sdp('102 96', ['a=rtpmap:96 VP8/90000', 'a=rtpmap:102 H264/90000']))).toBe('h264');
    expect(videoCodecFromSdp(sdp('96 102', ['a=rtpmap:96 VP8/90000', 'a=rtpmap:102 H264/90000']))).toBe('vp8');
  });
  it('returns null when there is no video', () => {
    expect(videoCodecFromSdp(undefined)).toBeNull();
    expect(videoCodecFromSdp('v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111')).toBeNull();
  });
});

describe('screenScaleFor', () => {
  it('fits a Retina capture within 1280×720 for H.264', () => {
    expect(screenScaleFor(2880, 1800, 'h264')).toBe(2.5);
    expect(screenScaleFor(1920, 1080, 'h264')).toBe(1.5);
  });
  it('fits within 1920×1080 for other codecs', () => {
    expect(screenScaleFor(2880, 1800, 'vp8')).toBe(1.67);
    expect(screenScaleFor(1920, 1080, 'vp8')).toBe(1);
  });
  it('never upscales and tolerates unknown sizes', () => {
    expect(screenScaleFor(800, 600, 'h264')).toBe(1);
    expect(screenScaleFor(undefined, undefined, null)).toBe(1);
  });
});
