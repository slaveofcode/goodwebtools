/**
 * Timezone conversion + meeting-planner maths built on the Intl API (no data
 * bundled). Pure and framework-free; the island supplies the picked wall time
 * and the list of zones to display.
 */

export interface ZoneOption { zone: string; label: string }

/** A compact list of common IANA zones for the pickers. */
export const COMMON_ZONES: ZoneOption[] = [
  { zone: 'Pacific/Honolulu', label: 'Honolulu' },
  { zone: 'America/Los_Angeles', label: 'Los Angeles / San Francisco' },
  { zone: 'America/Denver', label: 'Denver' },
  { zone: 'America/Chicago', label: 'Chicago' },
  { zone: 'America/New_York', label: 'New York' },
  { zone: 'America/Sao_Paulo', label: 'São Paulo' },
  { zone: 'Europe/London', label: 'London' },
  { zone: 'Europe/Paris', label: 'Paris / Berlin / Madrid' },
  { zone: 'Europe/Moscow', label: 'Moscow' },
  { zone: 'Asia/Dubai', label: 'Dubai' },
  { zone: 'Asia/Kolkata', label: 'India (Kolkata)' },
  { zone: 'Asia/Jakarta', label: 'Jakarta / Bangkok (WIB)' },
  { zone: 'Asia/Singapore', label: 'Singapore / Kuala Lumpur' },
  { zone: 'Asia/Shanghai', label: 'China (Shanghai)' },
  { zone: 'Asia/Tokyo', label: 'Tokyo / Seoul' },
  { zone: 'Australia/Sydney', label: 'Sydney' },
  { zone: 'Pacific/Auckland', label: 'Auckland' },
  { zone: 'UTC', label: 'UTC' },
];

function partsInZone(instantMs: number, zone: string): Record<string, number> {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const out: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(instantMs))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  // Intl renders midnight as hour 24 in some engines; normalise to 0.
  if (out.hour === 24) out.hour = 0;
  return out;
}

/** Offset (ms) of a zone at a given instant: local wall time minus UTC. */
export function offsetMs(instantMs: number, zone: string): number {
  const p = partsInZone(instantMs, zone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - instantMs;
}

/** Human GMT offset label, e.g. "GMT+7" or "GMT-5:30". */
export function offsetLabel(instantMs: number, zone: string): string {
  const mins = Math.round(offsetMs(instantMs, zone) / 60000);
  const sign = mins >= 0 ? '+' : '-';
  const a = Math.abs(mins);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `GMT${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

/**
 * Interpret a wall-clock time (y, mo 1-12, d, h, min) in `zone` as an absolute
 * instant (ms since epoch). Corrects once for DST boundaries.
 */
export function wallTimeToInstant(y: number, mo: number, d: number, h: number, min: number, zone: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, min);
  const off1 = offsetMs(guess, zone);
  let instant = guess - off1;
  const off2 = offsetMs(instant, zone);
  if (off2 !== off1) instant = guess - off2;
  return instant;
}

/** Format an instant as wall time in a zone. */
export function formatInZone(instantMs: number, zone: string, lang = 'en'): string {
  return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', {
    timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    day: '2-digit', month: 'short',
  }).format(new Date(instantMs));
}
