import { useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import { parseColor, toHex, toHsl } from '@/tools/dev/color.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { color: string; pick: string; invalid: string; preview: string; placeholder: string }> = {
  en: {
    color: 'Color',
    pick: 'Pick',
    invalid: 'Enter a hex (#rrggbb) or rgb(r, g, b) color.',
    preview: 'Color preview',
    placeholder: '#7c3aed or rgb(124, 58, 237)',
  },
  id: {
    color: 'Warna',
    pick: 'Pilih',
    invalid: 'Masukkan warna hex (#rrggbb) atau rgb(r, g, b).',
    preview: 'Pratinjau warna',
    placeholder: '#7c3aed atau rgb(124, 58, 237)',
  },
};

export default function ColorConvert({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [input, setInput] = useState('#7c3aed');

  const rgb = parseColor(input);
  const invalid = input.trim() !== '' && rgb === null;

  const rows: [string, string][] = rgb
    ? [
        ['HEX', toHex(rgb)],
        ['RGB', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`],
        ['HSL', toHsl(rgb)],
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="min-w-[12rem] flex-1 space-y-1.5">
          <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t.color}
          </span>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t.placeholder}
            className="w-full border-2 border-border bg-muted px-3 py-2 font-mono text-sm outline-none focus:shadow-brutal-sm"
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t.pick}
          </span>
          <input
            type="color"
            value={rgb ? toHex(rgb) : '#000000'}
            onChange={e => setInput(e.target.value)}
            className="h-11 w-16 cursor-pointer border-2 border-border bg-muted"
          />
        </label>
      </div>

      {invalid && <Alert variant="error">{t.invalid}</Alert>}

      {rgb && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div
            className="h-28 w-full border-2 border-border shadow-brutal sm:w-40"
            style={{ backgroundColor: toHex(rgb) }}
            aria-label={t.preview}
          />
          <div className="flex-1 divide-y-2 divide-border border-2 border-border">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 bg-muted p-3">
                <div className="min-w-0">
                  <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                  <code className="block break-all text-sm">{value}</code>
                </div>
                <CopyButton value={value} label="" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
