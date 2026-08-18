import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { CopyButton } from '@/components/ui/CopyButton';
import { slugify } from '@/tools/dev/slugify.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; input: string; output: string; placeholder: string; separator: string; lowercase: string; strip: string }> = {
  en: {
    intro: 'Turn any title or text into a clean, URL-safe slug — lowercase, hyphenated, with accents folded and punctuation removed. Runs entirely in your browser.',
    input: 'Text',
    output: 'Slug',
    placeholder: 'e.g. My Awesome Blog Post!',
    separator: 'Separator',
    lowercase: 'Lowercase',
    strip: 'Fold accents (é → e)',
  },
  id: {
    intro: 'Ubah judul atau teks apa pun menjadi slug yang bersih dan aman untuk URL — huruf kecil, dengan tanda hubung, aksen diratakan, dan tanda baca dihapus. Berjalan sepenuhnya di browser Anda.',
    input: 'Teks',
    output: 'Slug',
    placeholder: 'mis. Postingan Blog Keren Saya!',
    separator: 'Pemisah',
    lowercase: 'Huruf kecil',
    strip: 'Ratakan aksen (é → e)',
  },
};

const SEPARATORS = ['-', '_', '.'];

export default function Slugify({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [text, setText] = useState('');
  const [separator, setSeparator] = useState('-');
  const [lowercase, setLowercase] = useState(true);
  const [stripDiacritics, setStripDiacritics] = useState(true);

  const slug = slugify(text, { separator, lowercase, stripDiacritics });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="space-y-1">
        <span className="block text-sm font-semibold">{t.input}</span>
        <TextArea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder={t.placeholder} monospace={false} />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">{t.separator}</span>
          <select
            value={separator}
            onChange={e => setSeparator(e.target.value)}
            className="rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-sm outline-none focus:border-accent"
          >
            {SEPARATORS.map(s => <option key={s} value={s}>{s === '-' ? '- (hyphen)' : s === '_' ? '_ (underscore)' : '. (dot)'}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={lowercase} onChange={e => setLowercase(e.target.checked)} className="h-4 w-4 accent-accent" />
          {t.lowercase}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={stripDiacritics} onChange={e => setStripDiacritics(e.target.checked)} className="h-4 w-4 accent-accent" />
          {t.strip}
        </label>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t.output}</span>
          {slug && <CopyButton value={slug} />}
        </div>
        <div className="min-h-[2.75rem] break-all rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm">
          {slug || <span className="text-muted-foreground">—</span>}
        </div>
      </div>
    </div>
  );
}
