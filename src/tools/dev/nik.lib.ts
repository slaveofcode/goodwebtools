/**
 * Indonesian NIK (Nomor Induk Kependudukan / KTP number) decoder — pure.
 *
 * Layout (16 digits): PP KK CC DDMMYY SSSS
 *   PP  province code       KK regency/city code   CC district (kecamatan) code
 *   DD  birth day (+40 for female)   MM month   YY 2-digit year   SSSS serial
 *
 * There is no checksum digit, so validation is structural: length, all digits,
 * a known province, and a plausible birth date. Everything runs locally — the
 * NIK (which is personal data) is never sent anywhere.
 */

export const PROVINCES: Record<string, string> = {
  '11': 'Aceh',
  '12': 'Sumatera Utara',
  '13': 'Sumatera Barat',
  '14': 'Riau',
  '15': 'Jambi',
  '16': 'Sumatera Selatan',
  '17': 'Bengkulu',
  '18': 'Lampung',
  '19': 'Kepulauan Bangka Belitung',
  '21': 'Kepulauan Riau',
  '31': 'DKI Jakarta',
  '32': 'Jawa Barat',
  '33': 'Jawa Tengah',
  '34': 'DI Yogyakarta',
  '35': 'Jawa Timur',
  '36': 'Banten',
  '51': 'Bali',
  '52': 'Nusa Tenggara Barat',
  '53': 'Nusa Tenggara Timur',
  '61': 'Kalimantan Barat',
  '62': 'Kalimantan Tengah',
  '63': 'Kalimantan Selatan',
  '64': 'Kalimantan Timur',
  '65': 'Kalimantan Utara',
  '71': 'Sulawesi Utara',
  '72': 'Sulawesi Tengah',
  '73': 'Sulawesi Selatan',
  '74': 'Sulawesi Tenggara',
  '75': 'Gorontalo',
  '76': 'Sulawesi Barat',
  '81': 'Maluku',
  '82': 'Maluku Utara',
  '91': 'Papua',
  '92': 'Papua Barat',
  '93': 'Papua Selatan',
  '94': 'Papua Tengah',
  '95': 'Papua Pegunungan',
  '96': 'Papua Barat Daya',
};

export interface NikResult {
  valid: boolean;
  issues: string[];
  provinceCode: string;
  province: string;
  regencyCode: string;
  districtCode: string;
  gender: 'male' | 'female';
  birthDate: { day: number; month: number; year: number } | null;
  birthDateISO: string | null;
  serial: string;
}

/** Decode and validate a NIK. `currentYear` drives the 2-digit-year century heuristic. */
export function parseNik(nik: string, currentYear: number): NikResult {
  const digits = nik.replace(/[\s.-]/g, '');
  const issues: string[] = [];

  const base: NikResult = {
    valid: false,
    issues,
    provinceCode: '',
    province: '',
    regencyCode: '',
    districtCode: '',
    gender: 'male',
    birthDate: null,
    birthDateISO: null,
    serial: '',
  };

  if (digits.length !== 16) {
    issues.push(`A NIK must be exactly 16 digits (got ${digits.length}).`);
    return base;
  }
  if (!/^\d{16}$/.test(digits)) {
    issues.push('A NIK must contain only digits.');
    return base;
  }

  const provinceCode = digits.slice(0, 2);
  const regencyCode = digits.slice(2, 4);
  const districtCode = digits.slice(4, 6);
  const rawDay = Number(digits.slice(6, 8));
  const month = Number(digits.slice(8, 10));
  const yy = Number(digits.slice(10, 12));
  const serial = digits.slice(12, 16);

  const province = PROVINCES[provinceCode] ?? '';
  if (!province) issues.push(`Unknown province code "${provinceCode}".`);

  const gender: 'male' | 'female' = rawDay > 40 ? 'female' : 'male';
  const day = gender === 'female' ? rawDay - 40 : rawDay;

  if (month < 1 || month > 12) issues.push(`Invalid birth month "${digits.slice(8, 10)}".`);
  if (day < 1 || day > 31) issues.push(`Invalid birth day "${digits.slice(6, 8)}".`);

  const fullYear = 2000 + yy <= currentYear ? 2000 + yy : 1900 + yy;
  const birthValid = month >= 1 && month <= 12 && day >= 1 && day <= 31;
  const birthDate = birthValid ? { day, month, year: fullYear } : null;
  const p2 = (n: number) => String(n).padStart(2, '0');
  const birthDateISO = birthDate ? `${birthDate.year}-${p2(month)}-${p2(day)}` : null;

  return {
    valid: issues.length === 0,
    issues,
    provinceCode,
    province,
    regencyCode,
    districtCode,
    gender,
    birthDate,
    birthDateISO,
    serial,
  };
}
