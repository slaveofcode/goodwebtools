import type { LatLng } from './coord.lib';

/** CARTO raster tiles (free, no API key, Fastly CDN). 'auto' follows the site theme. */
export type StyleChoice = 'auto' | 'liberty' | 'bright' | 'positron' | 'dark';
export type ConcreteStyle = Exclude<StyleChoice, 'auto'>;

export const MAP_STYLES: { id: StyleChoice; label: string }[] = [
  { id: 'auto', label: 'Match site' },
  { id: 'liberty', label: 'Liberty' },
  { id: 'bright', label: 'Bright' },
  { id: 'positron', label: 'Positron' },
  { id: 'dark', label: 'Dark' },
];

type CartoVariant = 'voyager' | 'light' | 'dark';

const CARTO_PATH: Record<CartoVariant, string> = {
  voyager: 'rastertiles/voyager',
  light:   'light_all',
  dark:    'dark_all',
};

const STYLE_VARIANT: Record<ConcreteStyle, CartoVariant> = {
  liberty:  'voyager',
  bright:   'light',
  positron: 'light',
  dark:     'dark',
};

const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cartoMapStyle(variant: CartoVariant): Record<string, any> {
  const path = CARTO_PATH[variant];
  const tiles = (['a','b','c','d'] as const).map(
    s => `https://${s}.basemaps.cartocdn.com/${path}/{z}/{x}/{y}@2x.png`
  );
  return {
    version: 8,
    sources: {
      carto: { type: 'raster', tiles, tileSize: 512, attribution: ATTRIBUTION },
    },
    layers: [{ id: 'carto', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 22 }],
  };
}

/** Resolve a style choice (+ current site theme) to a concrete CARTO raster style object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveStyle(choice: StyleChoice, siteTheme: 'light' | 'dark'): { id: ConcreteStyle; style: Record<string, any> } {
  const id: ConcreteStyle = choice === 'auto' ? (siteTheme === 'dark' ? 'dark' : 'liberty') : choice;
  return { id, style: cartoMapStyle(STYLE_VARIANT[id]) };
}

/** Great-circle distance between two points, in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Human-readable distance. */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}
