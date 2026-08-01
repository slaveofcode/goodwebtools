import { describe, it, expect } from 'vitest';
import { normalizeGeoJson, computeBbox, parseGeoJsonText } from './geo-parse.lib';

describe('normalizeGeoJson', () => {
  it('wraps a bare geometry into a FeatureCollection', () => {
    const fc = normalizeGeoJson({ type: 'Point', coordinates: [10, 20] });
    expect(fc?.type).toBe('FeatureCollection');
    expect(fc?.features).toHaveLength(1);
    expect(fc?.features[0].geometry).toEqual({ type: 'Point', coordinates: [10, 20] });
  });
  it('wraps a bare Feature', () => {
    const fc = normalizeGeoJson({ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { a: 1 } });
    expect(fc?.features).toHaveLength(1);
    expect(fc?.features[0].properties).toEqual({ a: 1 });
  });
  it('passes a FeatureCollection through', () => {
    const input = { type: 'FeatureCollection', features: [] };
    expect(normalizeGeoJson(input)?.type).toBe('FeatureCollection');
  });
  it('rejects non-geojson', () => {
    expect(normalizeGeoJson({ hello: 'world' })).toBeNull();
    expect(normalizeGeoJson(null)).toBeNull();
  });
});

describe('computeBbox', () => {
  it('spans all coordinates across geometry types', () => {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [0, 0] } },
        { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [[10, -5], [-3, 8]] } },
      ],
    };
    expect(computeBbox(fc)).toEqual([-3, -5, 10, 8]);
  });
  it('returns null when there are no coordinates', () => {
    expect(computeBbox({ type: 'FeatureCollection', features: [] })).toBeNull();
  });
});

describe('parseGeoJsonText', () => {
  it('parses valid text', () => {
    expect(parseGeoJsonText('{"type":"Point","coordinates":[1,2]}')?.features).toHaveLength(1);
  });
  it('returns null on invalid JSON', () => {
    expect(parseGeoJsonText('not json')).toBeNull();
  });
});
