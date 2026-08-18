/**
 * Parse a user-agent string into browser / engine / OS names. Pure and
 * framework-free so it can be unit-tested; the island feeds it the live
 * navigator.userAgent and reads screen/viewport separately.
 *
 * UA parsing is inherently heuristic (and UAs lie) — this covers the common
 * desktop/mobile browsers well enough for a "what am I running" readout.
 */

export interface UaInfo {
  browser: string;
  browserVersion: string;
  engine: string;
  os: string;
}

function version(ua: string, re: RegExp): string {
  const m = ua.match(re);
  return m?.[1]?.replace(/_/g, '.') ?? '';
}

/** Detect the browser name and version. Order matters — Edge/Opera spoof Chrome. */
export function parseBrowser(ua: string): { name: string; version: string } {
  if (/Edg(?:e|A|iOS)?\//.test(ua)) return { name: 'Edge', version: version(ua, /Edg(?:e|A|iOS)?\/([\d.]+)/) };
  if (/OPR\/|Opera/.test(ua)) return { name: 'Opera', version: version(ua, /(?:OPR|Version)\/([\d.]+)/) };
  if (/SamsungBrowser\//.test(ua)) return { name: 'Samsung Internet', version: version(ua, /SamsungBrowser\/([\d.]+)/) };
  if (/Firefox\/|FxiOS\//.test(ua)) return { name: 'Firefox', version: version(ua, /(?:Firefox|FxiOS)\/([\d.]+)/) };
  if (/Chrome\/|CriOS\//.test(ua)) return { name: 'Chrome', version: version(ua, /(?:Chrome|CriOS)\/([\d.]+)/) };
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return { name: 'Safari', version: version(ua, /Version\/([\d.]+)/) };
  if (/MSIE |Trident\//.test(ua)) return { name: 'Internet Explorer', version: version(ua, /(?:MSIE |rv:)([\d.]+)/) };
  return { name: 'Unknown', version: '' };
}

/** Detect the layout/rendering engine. */
export function parseEngine(ua: string): string {
  if (/Gecko\//.test(ua) && /Firefox/.test(ua)) return 'Gecko';
  if (/Trident\//.test(ua)) return 'Trident';
  if (/Edg(?:e|A|iOS)?\/|Chrome\/|CriOS\/|OPR\//.test(ua)) return 'Blink';
  if (/AppleWebKit\//.test(ua)) return 'WebKit';
  return 'Unknown';
}

/** Detect the operating system and, where available, its version. */
export function parseOS(ua: string): string {
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows NT 6\.3/.test(ua)) return 'Windows 8.1';
  if (/Windows NT 6\.1/.test(ua)) return 'Windows 7';
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return `Android ${version(ua, /Android ([\d.]+)/)}`.trim();
  if (/(iPhone|iPad|iPod)/.test(ua)) return `iOS ${version(ua, /OS ([\d_]+)/)}`.trim();
  if (/Mac OS X/.test(ua)) return `macOS ${version(ua, /Mac OS X ([\d_]+)/)}`.trim();
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

/** Full parse of a user-agent string. */
export function parseUserAgent(ua: string): UaInfo {
  const b = parseBrowser(ua);
  return { browser: b.name, browserVersion: b.version, engine: parseEngine(ua), os: parseOS(ua) };
}
