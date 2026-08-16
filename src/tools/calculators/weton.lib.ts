/**
 * Javanese weton: the pairing of the 7-day week with the 5-day pasaran cycle,
 * plus each part's neptu (numeric value). Pure and UTC-based.
 *
 * Pasaran is anchored to 17 August 1945 = Legi (a widely documented weton —
 * "Jumat Legi", Indonesian Independence Day). The weekday is read directly from
 * the date, so it is always correct regardless of the anchor.
 */

const WEEKDAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
// Neptu for Minggu..Sabtu (index = getUTCDay()).
const WEEKDAY_NEPTU = [5, 4, 3, 7, 8, 6, 9];

const PASARAN = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon'];
const PASARAN_NEPTU = [5, 9, 7, 4, 8];

// Anchor: 1945-08-17 has pasaran index 0 (Legi).
const ANCHOR_UTC = Date.UTC(1945, 7, 17);
const DAY_MS = 86_400_000;

export interface Weton {
  weekday: string;
  pasaran: string;
  label: string;
  neptu: { weekday: number; pasaran: number; total: number };
}

export function weton(date: Date): Weton {
  const wd = date.getUTCDay();
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const diffDays = Math.round((midnight - ANCHOR_UTC) / DAY_MS);
  const pIdx = ((diffDays % 5) + 5) % 5;
  const weekdayNeptu = WEEKDAY_NEPTU[wd];
  const pasaranNeptu = PASARAN_NEPTU[pIdx];
  return {
    weekday: WEEKDAYS_ID[wd],
    pasaran: PASARAN[pIdx],
    label: `${WEEKDAYS_ID[wd]} ${PASARAN[pIdx]}`,
    neptu: { weekday: weekdayNeptu, pasaran: pasaranNeptu, total: weekdayNeptu + pasaranNeptu },
  };
}
