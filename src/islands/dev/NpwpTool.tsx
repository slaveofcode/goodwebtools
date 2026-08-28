import { useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import { analyzeNpwp } from '@/tools/dev/npwp.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Validate and format an Indonesian NPWP (taxpayer ID). Type the number and it checks the length and formats a 15-digit NPWP. Runs in your browser.',
    label: 'NPWP number', formatted: 'Formatted', type: 'Type',
    valid: 'Valid', invalid: 'Invalid — an NPWP has 15 digits (legacy) or 16 (NIK-based).',
    legacy: 'Legacy 15-digit NPWP', nik: '16-digit (NIK-based) NPWP',
  },
  id: {
    intro: 'Validasi dan format NPWP (Nomor Pokok Wajib Pajak) Indonesia. Ketik nomornya dan tool memeriksa panjang serta memformat NPWP 15 digit. Berjalan di browser Anda.',
    label: 'Nomor NPWP', formatted: 'Terformat', type: 'Jenis',
    valid: 'Valid', invalid: 'Tidak valid — NPWP terdiri dari 15 digit (lama) atau 16 (berbasis NIK).',
    legacy: 'NPWP lama 15 digit', nik: 'NPWP 16 digit (berbasis NIK)',
  },
};

export default function NpwpTool({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [value, setValue] = useState('09.254.294.3-407.000');
  const info = analyzeNpwp(value);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <label className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.label}</span>
        <input value={value} onChange={e => setValue(e.target.value)} inputMode="numeric"
          className="w-full border-2 border-border bg-muted p-2 font-mono text-lg tabular-nums" />
      </label>

      {value.trim() && (
        info.valid ? (
          <div className="space-y-3 border-2 border-border bg-lime-200 p-4 text-black shadow-brutal dark:bg-lime-900/40 dark:text-white">
            <div className="text-sm font-bold uppercase tracking-wide">✓ {t.valid} · {info.kind === 'legacy-15' ? t.legacy : t.nik}</div>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">{t.formatted}</div>
                <div className="font-mono text-2xl font-black tabular-nums">{info.formatted}</div>
              </div>
              <CopyButton value={info.formatted} label="Copy" />
            </div>
            {info.taxpayerType && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">{t.type}</div>
                <div className="text-sm">{info.taxpayerType}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="border-2 border-border bg-yellow-300 p-3 text-sm font-medium text-black shadow-brutal-sm">{t.invalid}</div>
        )
      )}
    </div>
  );
}
