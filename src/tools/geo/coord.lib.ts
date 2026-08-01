/** Geographic coordinate conversions — all pure, no network. */

export interface LatLng { lat: number; lng: number }
export interface Utm { zone: number; hemisphere: 'N' | 'S'; easting: number; northing: number }

/** Parse "lat, lng" / "lat lng" decimal degrees. Returns null if out of range/malformed. */
export function parseLatLng(input: string): LatLng | null {
  const nums = input.trim().match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return null;
  const lat = parseFloat(nums[0]);
  const lng = parseFloat(nums[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function formatDd(lat: number, lng: number, digits = 6): string {
  return `${lat.toFixed(digits)}, ${lng.toFixed(digits)}`;
}

// --- DD ↔ DMS ---

function oneDms(deg: number, isLat: boolean): string {
  const hemi = deg >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFull = (abs - d) * 60;
  const m = Math.floor(mFull);
  const s = (mFull - m) * 60;
  return `${d}°${m}'${s.toFixed(1)}"${hemi}`;
}

export function ddToDms(lat: number, lng: number): { lat: string; lng: string } {
  return { lat: oneDms(lat, true), lng: oneDms(lng, false) };
}

function parseOneDms(str: string): number | null {
  const nums = str.match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return null;
  const d = parseFloat(nums[0]);
  const m = nums[1] ? parseFloat(nums[1]) : 0;
  const s = nums[2] ? parseFloat(nums[2]) : 0;
  let val = d + m / 60 + s / 3600;
  if (/[SW]/i.test(str)) val = -val;
  return val;
}

export function dmsToDd(latStr: string, lngStr: string): LatLng | null {
  const lat = parseOneDms(latStr);
  const lng = parseOneDms(lngStr);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// --- DD ↔ UTM (WGS84, USGS series) ---

const A = 6378137.0;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function ddToUtm(lat: number, lng: number): Utm {
  const zone = Math.floor((lng + 180) / 6) + 1;
  const lngOrigin = rad((zone - 1) * 6 - 180 + 3);
  const φ = rad(lat);
  const λ = rad(lng);
  const N = A / Math.sqrt(1 - E2 * Math.sin(φ) ** 2);
  const T = Math.tan(φ) ** 2;
  const C = EP2 * Math.cos(φ) ** 2;
  const AA = Math.cos(φ) * (λ - lngOrigin);
  const M =
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * φ -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * φ) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * φ) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * φ));
  const easting =
    K0 * N * (AA + ((1 - T + C) * AA ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * EP2) * AA ** 5) / 120) +
    500000;
  let northing =
    K0 *
    (M +
      N *
        Math.tan(φ) *
        ((AA * AA) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * AA ** 4) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * EP2) * AA ** 6) / 720));
  if (lat < 0) northing += 10000000;
  return { zone, hemisphere: lat >= 0 ? 'N' : 'S', easting, northing };
}

export function utmToDd(utm: Utm): LatLng {
  const x = utm.easting - 500000;
  let y = utm.northing;
  if (utm.hemisphere === 'S') y -= 10000000;
  const lngOrigin = (utm.zone - 1) * 6 - 180 + 3;
  const M = y / K0;
  const mu = M / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const φ1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const N1 = A / Math.sqrt(1 - E2 * Math.sin(φ1) ** 2);
  const T1 = Math.tan(φ1) ** 2;
  const C1 = EP2 * Math.cos(φ1) ** 2;
  const R1 = (A * (1 - E2)) / Math.pow(1 - E2 * Math.sin(φ1) ** 2, 1.5);
  const D = x / (N1 * K0);
  const lat =
    φ1 -
    ((N1 * Math.tan(φ1)) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6) / 720);
  const lng =
    rad(lngOrigin) +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5) / 120) /
      Math.cos(φ1);
  return { lat: deg(lat), lng: deg(lng) };
}

// --- Geohash ---

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(lat: number, lng: number, precision = 9): string {
  let latR = [-90, 90];
  let lngR = [-180, 180];
  let hash = '';
  let bit = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngR[0] + lngR[1]) / 2;
      if (lng >= mid) { ch |= 1 << (4 - bit); lngR = [mid, lngR[1]]; } else lngR = [lngR[0], mid];
    } else {
      const mid = (latR[0] + latR[1]) / 2;
      if (lat >= mid) { ch |= 1 << (4 - bit); latR = [mid, latR[1]]; } else latR = [latR[0], mid];
    }
    even = !even;
    if (bit < 4) bit++;
    else { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

export function decodeGeohash(hash: string): LatLng | null {
  let latR = [-90, 90];
  let lngR = [-180, 180];
  let even = true;
  for (const c of hash.toLowerCase()) {
    const idx = BASE32.indexOf(c);
    if (idx === -1) return null;
    for (let b = 4; b >= 0; b--) {
      const bit = (idx >> b) & 1;
      if (even) {
        const mid = (lngR[0] + lngR[1]) / 2;
        lngR = bit ? [mid, lngR[1]] : [lngR[0], mid];
      } else {
        const mid = (latR[0] + latR[1]) / 2;
        latR = bit ? [mid, latR[1]] : [latR[0], mid];
      }
      even = !even;
    }
  }
  return { lat: (latR[0] + latR[1]) / 2, lng: (lngR[0] + lngR[1]) / 2 };
}
