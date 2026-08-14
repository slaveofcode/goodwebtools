import { useMemo, useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { CopyButton } from '@/components/ui/CopyButton';
import { DownloadTextButton } from '@/components/ui/DownloadTextButton';
import { CLEANUP_OPS, cleanup } from '@/tools/dev/text.lib';
import type { Lang } from '@/i18n/config';

const OP_LABELS: Record<Lang, Record<string, string>> = {
  en: Object.fromEntries(CLEANUP_OPS.map(o => [o.key, o.label])),
  id: {
    trimLines: 'Rapikan tiap baris', collapseSpaces: 'Gabungkan spasi berulang',
    removeBlankLines: 'Hapus baris kosong', removeLineBreaks: 'Hapus jeda baris (gabung)',
    stripHtml: 'Hapus tag HTML', removeAccents: 'Hapus aksen/diakritik',
    dedupeLines: 'Hapus baris duplikat', sortLines: 'Urutkan baris A→Z',
  },
};

const TR: Record<Lang, { intro: string; input: string; output: string; ops: string; placeholder: string }> = {
  en: {
    intro: 'Clean up messy text — trim whitespace, collapse spaces, remove blank lines or line breaks, strip HTML, remove accents, dedupe and sort lines. Runs in your browser.',
    input: 'Text', output: 'Cleaned', ops: 'Operations', placeholder: 'Paste messy text…',
  },
  id: {
    intro: 'Bersihkan teks berantakan — rapikan spasi, gabungkan spasi, hapus baris kosong atau jeda baris, hapus HTML, hapus aksen, hapus duplikat, dan urutkan baris. Berjalan di browser Anda.',
    input: 'Teks', output: 'Hasil bersih', ops: 'Operasi', placeholder: 'Tempel teks berantakan…',
  },
};

export default function TextCleanup({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [text, setText] = useState('');
  const [ops, setOps] = useState<string[]>(['trimLines', 'collapseSpaces', 'removeBlankLines']);

  const output = useMemo(() => cleanup(text, ops), [text, ops]);
  const labels = OP_LABELS[lang] ?? OP_LABELS.en;

  const toggle = (key: string) =>
    setOps(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="space-y-1">
        <span className="block text-sm font-semibold">{t.ops}</span>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {CLEANUP_OPS.map(o => (
            <label key={o.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ops.includes(o.key)} onChange={() => toggle(o.key)} className="h-4 w-4 accent-accent" />
              {labels[o.key]}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1">
          <span className="block text-sm font-semibold">{t.input}</span>
          <TextArea value={text} onChange={e => setText(e.target.value)} rows={12} placeholder={t.placeholder} monospace={false} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t.output}</span>
            <div className="flex gap-2">
              <DownloadTextButton text={output} filename="cleaned.txt" />
              <CopyButton value={output} />
            </div>
          </div>
          <TextArea value={output} readOnly rows={12} monospace={false} />
        </div>
      </div>
    </div>
  );
}
