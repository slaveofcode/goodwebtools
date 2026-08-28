/**
 * Pure NPWP (Indonesian taxpayer ID) formatting + validation.
 *
 * The legacy NPWP is 15 digits, displayed as `XX.XXX.XXX.X-XXX.XXX`. Since 2024
 * individual taxpayers use their 16-digit NIK as the NPWP. There is no public
 * check digit, so validation is structural (digit count).
 */

export interface NpwpInfo {
  valid: boolean;
  digits: string;
  formatted: string;
  kind: 'legacy-15' | 'nik-16' | 'invalid';
  /** Taxpayer-type code (first two digits of a legacy NPWP), if applicable. */
  taxpayerType?: string;
}

const TAXPAYER_TYPES: Record<string, string> = {
  '01': 'Badan (corporate)',
  '02': 'Pengusaha (entrepreneur)',
  '04': 'Wajib Pajak Orang Pribadi (individual)',
  '05': 'Karyawan / bendaharawan',
  '06': 'Wajib Pajak Orang Pribadi (individual)',
  '07': 'Wajib Pajak Orang Pribadi (individual)',
  '08': 'Wajib Pajak Orang Pribadi (individual)',
  '09': 'Joint operation / lainnya',
  '31': 'Cabang (branch)',
};

/** Strip everything but digits. */
export function npwpDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/** Format a 15-digit legacy NPWP as `XX.XXX.XXX.X-XXX.XXX`; other lengths returned as-is. */
export function formatNpwp(input: string): string {
  const d = npwpDigits(input);
  if (d.length !== 15) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}.${d.slice(8, 9)}-${d.slice(9, 12)}.${d.slice(12, 15)}`;
}

/** Validate and describe an NPWP input. */
export function analyzeNpwp(input: string): NpwpInfo {
  const digits = npwpDigits(input);
  if (digits.length === 15) {
    const type = digits.slice(0, 2);
    return {
      valid: true, digits, formatted: formatNpwp(digits), kind: 'legacy-15',
      taxpayerType: TAXPAYER_TYPES[type] ?? 'Kode tidak dikenal',
    };
  }
  if (digits.length === 16) {
    return { valid: true, digits, formatted: digits, kind: 'nik-16' };
  }
  return { valid: false, digits, formatted: digits, kind: 'invalid' };
}
