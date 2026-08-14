import { describe, it, expect } from 'vitest';
import { parseCidr } from './cidr.lib';

describe('parseCidr', () => {
  it('computes a /24 network', () => {
    const r = parseCidr('192.168.1.10/24');
    expect(r.network).toBe('192.168.1.0');
    expect(r.broadcast).toBe('192.168.1.255');
    expect(r.netmask).toBe('255.255.255.0');
    expect(r.wildcard).toBe('0.0.0.255');
    expect(r.firstHost).toBe('192.168.1.1');
    expect(r.lastHost).toBe('192.168.1.254');
    expect(r.totalHosts).toBe(256);
    expect(r.usableHosts).toBe(254);
    expect(r.prefix).toBe(24);
    expect(r.ipClass).toBe('C');
  });

  it('handles a /32 single host', () => {
    const r = parseCidr('10.0.0.5/32');
    expect(r.network).toBe('10.0.0.5');
    expect(r.broadcast).toBe('10.0.0.5');
    expect(r.usableHosts).toBe(1);
    expect(r.ipClass).toBe('A');
  });

  it('handles a /31 point-to-point link', () => {
    const r = parseCidr('10.0.0.0/31');
    expect(r.usableHosts).toBe(2);
    expect(r.firstHost).toBe('10.0.0.0');
    expect(r.lastHost).toBe('10.0.0.1');
  });

  it('handles a /16 and defaults missing prefix to /32', () => {
    expect(parseCidr('172.16.5.4/16').netmask).toBe('255.255.0.0');
    expect(parseCidr('8.8.8.8').prefix).toBe(32);
  });

  it('rejects invalid input', () => {
    expect(() => parseCidr('999.1.1.1/24')).toThrow();
    expect(() => parseCidr('1.2.3.4/33')).toThrow();
    expect(() => parseCidr('not-an-ip')).toThrow();
  });
});
