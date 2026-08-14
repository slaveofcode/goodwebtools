/**
 * IPv4 CIDR / subnet calculator — pure, framework-free.
 */

export interface CidrInfo {
  address: string;
  prefix: number;
  netmask: string;
  wildcard: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalHosts: number;
  usableHosts: number;
  ipClass: string;
}

function ipToInt(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) throw new Error(`Invalid IPv4 address: ${ip}`);
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) throw new Error(`Invalid octet: ${p}`);
    const v = Number(p);
    if (v > 255) throw new Error(`Octet out of range: ${p}`);
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

function classOf(firstOctet: number): string {
  if (firstOctet < 128) return 'A';
  if (firstOctet < 192) return 'B';
  if (firstOctet < 224) return 'C';
  if (firstOctet < 240) return 'D (multicast)';
  return 'E (reserved)';
}

/** Parse an IPv4 address with optional /prefix (defaults to /32). */
export function parseCidr(input: string): CidrInfo {
  const trimmed = input.trim();
  const [addr, prefixStr = '32'] = trimmed.split('/');
  if (!/^\d{1,2}$/.test(prefixStr)) throw new Error(`Invalid prefix: ${prefixStr}`);
  const prefix = Number(prefixStr);
  if (prefix > 32) throw new Error('Prefix must be between 0 and 32.');

  const ip = ipToInt(addr);
  const netmask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const wildcard = ~netmask >>> 0;
  const network = (ip & netmask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;

  const totalHosts = 2 ** (32 - prefix);
  let usableHosts: number;
  let firstHost: number;
  let lastHost: number;
  if (prefix >= 31) {
    // /31 = point-to-point (2 usable), /32 = single host.
    usableHosts = prefix === 31 ? 2 : 1;
    firstHost = network;
    lastHost = broadcast;
  } else {
    usableHosts = totalHosts - 2;
    firstHost = (network + 1) >>> 0;
    lastHost = (broadcast - 1) >>> 0;
  }

  return {
    address: intToIp(ip),
    prefix,
    netmask: intToIp(netmask),
    wildcard: intToIp(wildcard),
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    firstHost: intToIp(firstHost),
    lastHost: intToIp(lastHost),
    totalHosts,
    usableHosts,
    ipClass: classOf((ip >>> 24) & 255),
  };
}
