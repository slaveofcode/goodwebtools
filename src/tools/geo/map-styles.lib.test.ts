import { describe, it, expect } from 'vitest';
import { resolveStyle, MAP_STYLES, haversineMeters } from './map-styles.lib';

describe('resolveStyle', () => {
  it('auto follows the site theme', () => {
    expect(resolveStyle('auto', 'dark').id).toBe('dark');
    expect(resolveStyle('auto', 'light').id).toBe('liberty');
  });
  it('an explicit choice overrides the theme', () => {
    expect(resolveStyle('positron', 'dark').id).toBe('positron');
    expect(resolveStyle('dark', 'light').id).toBe('dark');
  });
  it('returns a MapLibre raster style object with CARTO tiles', () => {
    const { style } = resolveStyle('liberty', 'light');
    expect(style.version).toBe(8);
    expect((style.sources as Record<string, unknown>).carto).toBeDefined();
    const tiles = ((style.sources as Record<string, { tiles: string[] }>).carto).tiles;
    expect(tiles[0]).toMatch(/cartocdn\.com\/rastertiles\/voyager/);
  });
  it('uses dark_all tiles for the dark style', () => {
    const { style } = resolveStyle('dark', 'dark');
    const tiles = ((style.sources as Record<string, { tiles: string[] }>).carto).tiles;
    expect(tiles[0]).toMatch(/dark_all/);
  });
});

describe('MAP_STYLES', () => {
  it('exposes auto + the four styles', () => {
    expect(MAP_STYLES.map(s => s.id)).toEqual(['auto', 'liberty', 'bright', 'positron', 'dark']);
  });
});

describe('haversineMeters', () => {
  it('measures ~111km per degree of latitude', () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -2);
  });
  it('is zero for the same point', () => {
    expect(haversineMeters({ lat: 40, lng: -74 }, { lat: 40, lng: -74 })).toBe(0);
  });
});
