import type { LatLng } from './coord.lib';

/** OpenFreeMap styles (free, open, no API key). 'auto' follows the site theme. */
export type StyleChoice = 'auto' | 'liberty' | 'bright' | 'positron' | 'dark';
export type ConcreteStyle = Exclude<StyleChoice, 'auto'>;

export const MAP_STYLES: { id: StyleChoice; label: string }[] = [
  { id: 'auto', label: 'Match site' },
  { id: 'liberty', label: 'Liberty' },
  { id: 'bright', label: 'Bright' },
  { id: 'positron', label: 'Positron' },
  { id: 'dark', label: 'Dark' },
];

/** Resolve a style choice (+ current site theme) to a concrete OpenFreeMap style. */
export function resolveStyle(choice: StyleChoice, siteTheme: 'light' | 'dark'): { id: ConcreteStyle; url: string } {
  const id: ConcreteStyle = choice === 'auto' ? (siteTheme === 'dark' ? 'dark' : 'liberty') : choice;
  return { id, url: `/ofm/styles/${id}` };
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
