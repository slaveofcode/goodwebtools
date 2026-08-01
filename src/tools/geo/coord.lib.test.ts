import { describe, it, expect } from 'vitest';
import {
  parseLatLng,
  formatDd,
  ddToDms,
  dmsToDd,
  ddToUtm,
  utmToDd,
  encodeGeohash,
  decodeGeohash,
} from './coord.lib';

describe('parseLatLng', () => {
  it('parses "lat, lng" decimal pairs', () => {
    expect(parseLatLng('-6.2088, 106.8456')).toEqual({ lat: -6.2088, lng: 106.8456 });
    expect(parseLatLng('40.7128 -74.0060')).toEqual({ lat: 40.7128, lng: -74.006 });
  });
  it('rejects out-of-range or malformed input', () => {
    expect(parseLatLng('91, 0')).toBeNull();
    expect(parseLatLng('0, 181')).toBeNull();
    expect(parseLatLng('hello')).toBeNull();
    expect(parseLatLng('1')).toBeNull();
  });
});

describe('DD ↔ DMS', () => {
  it('formats DMS with hemisphere', () => {
    const dms = ddToDms(-6.2088, 106.8456);
    expect(dms.lat).toMatch(/6°12'.*S/);
    expect(dms.lng).toMatch(/106°50'.*E/);
  });
  it('round-trips DD → DMS → DD', () => {
    for (const [lat, lng] of [[40.7128, -74.006], [-33.8688, 151.2093], [51.5074, -0.1278]]) {
      const dms = ddToDms(lat, lng);
      const back = dmsToDd(dms.lat, dms.lng)!;
      expect(back.lat).toBeCloseTo(lat, 4);
      expect(back.lng).toBeCloseTo(lng, 4);
    }
  });
  it('parses varied DMS punctuation', () => {
    const back = dmsToDd('40 42 46 N', '74 0 21.6 W')!;
    expect(back.lat).toBeCloseTo(40.7128, 3);
    expect(back.lng).toBeCloseTo(-74.006, 3);
  });
});

describe('DD ↔ UTM', () => {
  it('computes the right zone and round-trips', () => {
    const cases: [number, number, number][] = [
      [40.7128, -74.006, 18],
      [-6.2088, 106.8456, 48],
      [51.5074, -0.1278, 30],
    ];
    for (const [lat, lng, zone] of cases) {
      const utm = ddToUtm(lat, lng);
      expect(utm.zone).toBe(zone);
      expect(utm.hemisphere).toBe(lat >= 0 ? 'N' : 'S');
      const back = utmToDd(utm);
      expect(back.lat).toBeCloseTo(lat, 4);
      expect(back.lng).toBeCloseTo(lng, 4);
    }
  });
});

describe('geohash', () => {
  it('encodes a known point', () => {
    // London ~ "gcpvj0..."
    expect(encodeGeohash(51.5074, -0.1278, 6)).toMatch(/^gcpv/);
  });
  it('round-trips within precision tolerance', () => {
    for (const [lat, lng] of [[40.7128, -74.006], [-6.2088, 106.8456]]) {
      const hash = encodeGeohash(lat, lng, 9);
      const back = decodeGeohash(hash)!;
      expect(back.lat).toBeCloseTo(lat, 3);
      expect(back.lng).toBeCloseTo(lng, 3);
    }
  });
  it('rejects invalid characters', () => {
    expect(decodeGeohash('ail')).toBeNull(); // a,i,l not in geohash alphabet
  });
});

describe('formatDd', () => {
  it('formats to a fixed precision', () => {
    expect(formatDd(-6.208812345, 106.845612345)).toBe('-6.208812, 106.845612');
  });
});
