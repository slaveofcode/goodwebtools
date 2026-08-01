import type { FeatureCollection, Geometry, Position } from 'geojson';

/** Coerce parsed JSON into a FeatureCollection (accepts geometry / Feature / FC). */
export function normalizeGeoJson(input: unknown): FeatureCollection | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as { type?: string };
  if (obj.type === 'FeatureCollection') return input as FeatureCollection;
  if (obj.type === 'Feature') {
    return { type: 'FeatureCollection', features: [input as FeatureCollection['features'][number]] };
  }
  const GEOM = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection'];
  if (obj.type && GEOM.includes(obj.type)) {
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: input as Geometry }] };
  }
  return null;
}

export function parseGeoJsonText(text: string): FeatureCollection | null {
  try {
    return normalizeGeoJson(JSON.parse(text));
  } catch {
    return null;
  }
}

function eachPosition(geom: Geometry | null, fn: (p: Position) => void): void {
  if (!geom) return;
  if (geom.type === 'GeometryCollection') { geom.geometries.forEach(g => eachPosition(g, fn)); return; }
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') fn(c as Position);
    else if (Array.isArray(c)) c.forEach(walk);
  };
  walk((geom as { coordinates?: unknown }).coordinates);
}

/** [minLng, minLat, maxLng, maxLat] over every coordinate, or null if empty. */
export function computeBbox(fc: FeatureCollection): [number, number, number, number] | null {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  let any = false;
  for (const f of fc.features) {
    eachPosition(f.geometry, ([lng, lat]) => {
      any = true;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    });
  }
  return any ? [minLng, minLat, maxLng, maxLat] : null;
}

/**
 * Parse a dropped geo file (GeoJSON/JSON, GPX, or KML) into a FeatureCollection.
 * GPX/KML use the DOM XML parser + @tmcw/togeojson (browser).
 */
export async function parseGeoFile(text: string, filename: string): Promise<FeatureCollection | null> {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'geojson' || ext === 'json') return parseGeoJsonText(text);
  if (ext === 'gpx' || ext === 'kml') {
    const { gpx, kml } = await import('@tmcw/togeojson');
    const dom = new DOMParser().parseFromString(text, 'text/xml');
    const fc = ext === 'gpx' ? gpx(dom) : kml(dom);
    return normalizeGeoJson(fc);
  }
  // Fall back to a JSON attempt.
  return parseGeoJsonText(text);
}
