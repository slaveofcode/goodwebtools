import { useMemo, useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import { terbilang, terbilangRupiah, capitalize } from '@/tools/dev/terbilang.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; label: string; words: string; rupiah: string; placeholder: string }> = {
  en: {
    intro: 'Convert a number into Indonesian words (terbilang) — handy for invoices, cheques and kwitansi. Runs entirely in your browser.',
    label: 'Number',
    words: 'In words',
    rupiah: 'As rupiah',
    placeholder: 'e.g. 1500000',
  },
  id: {
    intro: 'Ubah angka menjadi terbilang (kata-kata Bahasa Indonesia) — berguna untuk invoice, cek, dan kwitansi. Berjalan sepenuhnya di browser Anda.',
    label: 'Angka',
    words: 'Terbilang',
    rupiah: 'Dalam rupiah',
    placeholder: 'mis. 1500000',
  },
};

export default function Terbilang({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [value, setValue] = useState('');

  const num = useMemo(() => {
    const cleaned = value.replace(/[.,\s]/g, '');
    return /^-?\d+$/.test(cleaned) ? Number(cleaned) : null;
  }, [value]);

  const words = num !== null ? capitalize(terbilang(num)) : '';
  const rupiah = num !== null ? capitalize(terbilangRupiah(num)) : '';
  const grouped = num !== null ? new Intl.NumberFormat('id-ID').format(num) : '';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <label className="block space-y-1">
        <span className="block text-sm font-semibold">{t.label}</span>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          inputMode="numeric"
          spellCheck={false}
          className="w-full border-2 border-border bg-muted p-3 font-mono text-lg"
          placeholder={t.placeholder}
        />
        {grouped && <span className="text-xs text-muted-foreground">{grouped}</span>}
      </label>

      {num !== null && (
        <div className="space-y-3">
          {[{ label: t.words, text: words }, { label: t.rupiah, text: rupiah }].map(o => (
            <div key={o.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{o.label}</span>
                <CopyButton value={o.text} />
              </div>
              <div className="border-2 border-border bg-muted p-3 text-lg">{o.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
