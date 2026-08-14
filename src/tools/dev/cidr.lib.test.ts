import { describe, it, expect } from 'vitest';
import { parseCidr, parseIpv6Cidr, parseCidrAny } from './cidr.lib';

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

  it('tags the version', () => {
    expect(parseCidr('10.0.0.0/8').version).toBe(4);
  });
});

describe('parseIpv6Cidr', () => {
  it('computes a /32 network', () => {
    const r = parseIpv6Cidr('2001:db8::/32');
    expect(r.version).toBe(6);
    expect(r.network).toBe('2001:db8::');
    expect(r.firstAddress).toBe('2001:db8::');
    expect(r.lastAddress).toBe('2001:db8:ffff:ffff:ffff:ffff:ffff:ffff');
    expect(r.totalAddresses).toBe((2n ** 96n).toString());
    expect(r.prefix).toBe(32);
  });

  it('handles a single host /128 and :: compression', () => {
    const r = parseIpv6Cidr('::1/128');
    expect(r.address).toBe('::1');
    expect(r.network).toBe('::1');
    expect(r.totalAddresses).toBe('1');
  });

  it('masks a /64 correctly', () => {
    expect(parseIpv6Cidr('fe80::abcd:1234/64').network).toBe('fe80::');
  });

  it('expands the full address form', () => {
    expect(parseIpv6Cidr('2001:db8::1/64').fullAddress).toBe('2001:0db8:0000:0000:0000:0000:0000:0001');
  });

  it('accepts an embedded IPv4 tail', () => {
    expect(() => parseIpv6Cidr('::ffff:192.168.1.1/128')).not.toThrow();
  });

  it('rejects invalid IPv6', () => {
    expect(() => parseIpv6Cidr('gggg::/16')).toThrow();
    expect(() => parseIpv6Cidr('2001:db8::/129')).toThrow();
    expect(() => parseIpv6Cidr('1::2::3/64')).toThrow();
  });
});

describe('parseCidrAny', () => {
  it('dispatches by address family', () => {
    expect(parseCidrAny('192.168.0.0/24').version).toBe(4);
    expect(parseCidrAny('2001:db8::/48').version).toBe(6);
  });
});
