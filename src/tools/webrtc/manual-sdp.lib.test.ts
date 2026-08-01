import { describe, it, expect } from 'vitest';
import { encodeSdp, decodeSdp } from './manual-sdp.lib';

describe('encodeSdp / decodeSdp', () => {
  it('round-trips an offer description', () => {
    const desc = { type: 'offer' as RTCSdpType, sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n' };
    const code = encodeSdp(desc);
    expect(typeof code).toBe('string');
    expect(code).not.toContain(' ');
    expect(decodeSdp(code)).toEqual(desc);
  });
  it('handles unicode in the sdp safely', () => {
    const desc = { type: 'answer' as RTCSdpType, sdp: 'naïve—café ☃' };
    expect(decodeSdp(encodeSdp(desc))).toEqual(desc);
  });
  it('rejects malformed codes', () => {
    expect(decodeSdp('')).toBeNull();
    expect(decodeSdp('!!!not-base64!!!')).toBeNull();
    expect(decodeSdp(btoa('{"type":"offer"}'))).toBeNull(); // missing sdp
    expect(decodeSdp(btoa('not json'))).toBeNull();
    expect(decodeSdp(btoa(JSON.stringify({ type: 'bogus', sdp: 'x' })))).toBeNull();
  });
});
