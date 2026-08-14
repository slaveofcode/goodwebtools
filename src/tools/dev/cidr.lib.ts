/**
 * IPv4 CIDR / subnet calculator — pure, framework-free.
 */

export interface CidrInfo {
  version: 4;
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
    version: 4,
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

// --- IPv6 --------------------------------------------------------------------

export interface Ipv6Info {
  version: 6;
  address: string; // compressed
  fullAddress: string; // fully expanded
  prefix: number;
  network: string;
  firstAddress: string;
  lastAddress: string;
  totalAddresses: string; // may be astronomically large → decimal string
}

/** Expand an IPv6 string to its eight 16-bit groups, handling :: and embedded IPv4. */
function ipv6Groups(addr: string): number[] {
  let a = addr.trim();

  // Fold a trailing dotted-quad (e.g. ::ffff:192.168.1.1) into two hex groups.
  const v4 = a.match(/^(.*:)((?:\d{1,3}\.){3}\d{1,3})$/);
  if (v4) {
    const octets = v4[2].split('.').map(Number);
    if (octets.some(o => o > 255)) throw new Error('Invalid embedded IPv4');
    a = `${v4[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }

  let groups: string[];
  if (a.includes('::')) {
    const halves = a.split('::');
    if (halves.length > 2) throw new Error('Invalid IPv6: multiple "::"');
    const head = halves[0] ? halves[0].split(':') : [];
    const tail = halves[1] ? halves[1].split(':') : [];
    const fill = 8 - head.length - tail.length;
    if (fill < 1) throw new Error('Invalid IPv6: "::" must cover at least one group');
    groups = [...head, ...Array(fill).fill('0'), ...tail];
  } else {
    groups = a.split(':');
  }

  if (groups.length !== 8) throw new Error('Invalid IPv6 address length');
  return groups.map(g => {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) throw new Error(`Invalid IPv6 group: ${g}`);
    return parseInt(g, 16);
  });
}

function ipv6ToBig(addr: string): bigint {
  return ipv6Groups(addr).reduce((n, g) => (n << 16n) | BigInt(g), 0n);
}

function bigToGroups(n: bigint): number[] {
  const g = new Array<number>(8);
  for (let i = 7; i >= 0; i--) { g[i] = Number(n & 0xffffn); n >>= 16n; }
  return g;
}

function expandIpv6(n: bigint): string {
  return bigToGroups(n).map(g => g.toString(16).padStart(4, '0')).join(':');
}

/** Compress to the canonical shortest form (RFC 5952): longest zero run → "::". */
function compressIpv6(n: bigint): string {
  const g = bigToGroups(n).map(x => x.toString(16));
  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (g[i] === '0') {
      if (curStart < 0) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curStart = -1; curLen = 0;
    }
  }
  if (bestLen < 2) return g.join(':');
  const before = g.slice(0, bestStart).join(':');
  const after = g.slice(bestStart + bestLen).join(':');
  return `${before}::${after}`;
}

/** Parse an IPv6 address with optional /prefix (defaults to /128). */
export function parseIpv6Cidr(input: string): Ipv6Info {
  const [addr, prefixStr = '128'] = input.trim().split('/');
  if (!/^\d{1,3}$/.test(prefixStr)) throw new Error(`Invalid prefix: ${prefixStr}`);
  const prefix = Number(prefixStr);
  if (prefix > 128) throw new Error('Prefix must be between 0 and 128.');

  const ip = ipv6ToBig(addr);
  const hostBits = BigInt(128 - prefix);
  const mask = prefix === 0 ? 0n : (((1n << BigInt(prefix)) - 1n) << hostBits);
  const network = ip & mask;
  const last = network | ((1n << hostBits) - 1n);

  return {
    version: 6,
    address: compressIpv6(ip),
    fullAddress: expandIpv6(ip),
    prefix,
    network: compressIpv6(network),
    firstAddress: compressIpv6(network),
    lastAddress: compressIpv6(last),
    totalAddresses: (1n << hostBits).toString(),
  };
}

/** Parse an IPv4 or IPv6 CIDR, dispatching by address family. */
export function parseCidrAny(input: string): CidrInfo | Ipv6Info {
  return input.includes(':') ? parseIpv6Cidr(input) : parseCidr(input);
}
