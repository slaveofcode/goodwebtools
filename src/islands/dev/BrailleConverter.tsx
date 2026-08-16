import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { toBraille } from '@/tools/dev/braille.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Convert text to Grade 1 (uncontracted) Unicode braille — letters, numbers and common punctuation, with capital and number signs. Copy the braille or download it. Everything runs in your browser.',
    input: 'Text', output: 'Braille (Grade 1)', placeholder: 'Type or paste text…',
    download: 'Download .txt', note: 'This is uncontracted Grade 1 braille as Unicode cells. Contracted Grade 2 and BRF embosser files are not produced.',
  },
  id: {
    intro: 'Konversi teks ke braille Unicode Grade 1 (tanpa kontraksi) — huruf, angka, dan tanda baca umum, dengan tanda kapital dan angka. Salin braille-nya atau unduh. Semuanya berjalan di browser Anda.',
    input: 'Teks', output: 'Braille (Grade 1)', placeholder: 'Ketik atau tempel teks…',
    download: 'Unduh .txt', note: 'Ini braille Grade 1 tanpa kontraksi sebagai sel Unicode. Grade 2 terkontraksi dan berkas embosser BRF tidak dihasilkan.',
  },
};

export default function BrailleConverter({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [text, setText] = useState('');
  const braille = useMemo(() => toBraille(text), [text]);

  const download = () => {
    const blob = new Blob([braille], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'braille.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <label className="space-y-1 text-sm block">
        <span className="font-semibold">{t.input}</span>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder={t.placeholder}
          className="w-full resize-y border-2 border-border bg-muted p-3 text-sm" />
      </label>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t.output}</span>
          <div className="flex gap-2">
            <CopyButton value={braille} />
            <Button variant="secondary" onClick={download} disabled={!braille}>{t.download}</Button>
          </div>
        </div>
        <div className="min-h-[4rem] whitespace-pre-wrap break-words border-2 border-border bg-background p-3 text-2xl leading-relaxed">
          {braille}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t.note}</p>
    </div>
  );
}
