import { describe, it, expect } from 'vitest';
import { DEFAULT_ICE_SERVERS, parseIceConfig, effectiveIceServers } from './ice.lib';

describe('parseIceConfig', () => {
  it('parses a STUN line', () => {
    const { servers, invalid } = parseIceConfig('stun:stun.example.com:3478');
    expect(servers).toEqual([{ urls: ['stun:stun.example.com:3478'] }]);
    expect(invalid).toEqual([]);
  });
  it('parses a TURN line with username and credential', () => {
    const { servers } = parseIceConfig('turn:turn.example.com:3478 alice s3cret');
    expect(servers[0]).toEqual({
      urls: ['turn:turn.example.com:3478'],
      username: 'alice',
      credential: 's3cret',
    });
  });
  it('ignores blank lines and # comments', () => {
    const { servers } = parseIceConfig('\n# my servers\nstun:a.com:3478\n\n');
    expect(servers).toHaveLength(1);
  });
  it('collects invalid lines by scheme', () => {
    const { servers, invalid } = parseIceConfig('http://nope\nstun:ok.com:3478');
    expect(servers).toHaveLength(1);
    expect(invalid).toEqual(['http://nope']);
  });
  it('supports comma-separated urls on one line', () => {
    const { servers } = parseIceConfig('stun:a.com:3478,stun:b.com:3478');
    expect(servers[0].urls).toEqual(['stun:a.com:3478', 'stun:b.com:3478']);
  });
});

describe('effectiveIceServers', () => {
  it('falls back to the public default when input is empty', () => {
    expect(effectiveIceServers('')).toBe(DEFAULT_ICE_SERVERS);
    expect(effectiveIceServers('   \n # only comment')).toBe(DEFAULT_ICE_SERVERS);
  });
  it('uses parsed servers when provided', () => {
    const servers = effectiveIceServers('stun:my.com:3478');
    expect(servers).not.toBe(DEFAULT_ICE_SERVERS);
    expect(servers[0].urls).toEqual(['stun:my.com:3478']);
  });
});
