import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { CopyButton } from '@/components/ui/CopyButton';
import { parseNik } from '@/tools/dev/nik.lib';
import type { Lang } from '@/i18n/config';

const MONTHS: Record<Lang, string[]> = {
  en: ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  id: ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
};

const TR: Record<Lang, {
  intro: string;
  label: string;
  valid: string;
  invalid: string;
  labels: { province: string; regency: string; district: string; gender: string; birthDate: string; age: string; serial: string };
  male: string;
  female: string;
  years: string;
  example: string;
  privacy: string;
}> = {
  en: {
    intro: 'Validate an Indonesian NIK (the 16-digit KTP number) and break out the province, birth date, gender and serial. It runs entirely in your browser — the NIK is never uploaded.',
    label: 'NIK (16 digits)',
    valid: 'Valid structure',
    invalid: 'Invalid',
    labels: { province: 'Province', regency: 'Regency/city code', district: 'District code', gender: 'Gender', birthDate: 'Birth date', age: 'Age', serial: 'Serial' },
    male: 'Male', female: 'Female', years: 'years',
    example: 'Load example',
    privacy: 'A NIK is personal data — this tool decodes it locally and never sends it anywhere.',
  },
  id: {
    intro: 'Validasi NIK Indonesia (nomor KTP 16 digit) dan uraikan provinsi, tanggal lahir, jenis kelamin, dan serial. Berjalan sepenuhnya di browser Anda — NIK tidak pernah diunggah.',
    label: 'NIK (16 digit)',
    valid: 'Struktur valid',
    invalid: 'Tidak valid',
    labels: { province: 'Provinsi', regency: 'Kode kabupaten/kota', district: 'Kode kecamatan', gender: 'Jenis kelamin', birthDate: 'Tanggal lahir', age: 'Usia', serial: 'Serial' },
    male: 'Laki-laki', female: 'Perempuan', years: 'tahun',
    example: 'Muat contoh',
    privacy: 'NIK adalah data pribadi — tool ini men-decode secara lokal dan tidak pernah mengirimnya ke mana pun.',
  },
};

function ageFrom(iso: string): number {
  const b = new Date(iso + 'T00:00:00');
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export default function NikDecoder({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [value, setValue] = useState('');

  const result = useMemo(() => (value.trim() ? parseNik(value, new Date().getFullYear()) : null), [value]);

  const rows = result
    ? [
        { label: t.labels.province, value: result.province ? `${result.province} (${result.provinceCode})` : `— (${result.provinceCode})` },
        { label: t.labels.regency, value: result.regencyCode },
        { label: t.labels.district, value: result.districtCode },
        { label: t.labels.gender, value: result.gender === 'female' ? t.female : t.male },
        {
          label: t.labels.birthDate,
          value: result.birthDate
            ? `${result.birthDate.day} ${MONTHS[lang][result.birthDate.month]} ${result.birthDate.year}`
            : '—',
        },
        { label: t.labels.age, value: result.birthDateISO ? `${ageFrom(result.birthDateISO)} ${t.years}` : '—' },
        { label: t.labels.serial, value: result.serial },
      ]
    : [];

  const copyText = result ? rows.map(r => `${r.label}: ${r.value}`).join('\n') : '';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t.label}</span>
          <button type="button" onClick={() => setValue('3175711708900001')} className="text-sm text-accent underline">
            {t.example}
          </button>
        </div>
        <input
          value={value}
          onChange={e => setValue(e.target.value.replace(/[^\d\s.-]/g, '').slice(0, 20))}
          inputMode="numeric"
          spellCheck={false}
          className="w-full border-2 border-border bg-muted p-3 font-mono text-lg tracking-wider"
          placeholder="3201234567890001"
        />
      </div>

      <p className="text-xs text-muted-foreground">{t.privacy}</p>

      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`border-2 px-2 py-0.5 text-xs font-bold ${
              result.valid
                ? 'border-green-600 text-green-700 dark:border-green-400 dark:text-green-400'
                : 'border-red-500 text-red-600 dark:text-red-400'
            }`}>
              {result.valid ? t.valid : t.invalid}
            </span>
            <CopyButton value={copyText} />
          </div>

          {result.issues.length > 0 && (
            <Alert variant="error">
              <ul className="list-inside list-disc">
                {result.issues.map((iss, i) => <li key={i}>{iss}</li>)}
              </ul>
            </Alert>
          )}

          {result.birthDate && (
            <div className="divide-y divide-border border-2 border-border">
              {rows.map(r => (
                <div key={r.label} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2 text-sm">
                  <span className="w-44 shrink-0 font-medium text-muted-foreground">{r.label}</span>
                  <span className="break-all font-mono">{r.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
