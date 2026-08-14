import { useEffect, useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { CopyButton } from '@/components/ui/CopyButton';
import { HASH_ALGOS, hashAll, type HashAlgo } from '@/tools/dev/hash-text.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; input: string; placeholder: string; empty: string; uppercase: string }> = {
  en: {
    intro: 'Generate MD5, SHA-1, SHA-256, SHA-512 and CRC32 hashes of any text, instantly and entirely in your browser — nothing is uploaded.',
    input: 'Text to hash',
    placeholder: 'Type or paste text…',
    empty: 'Enter some text to see its hashes.',
    uppercase: 'Uppercase',
  },
  id: {
    intro: 'Buat hash MD5, SHA-1, SHA-256, SHA-512, dan CRC32 dari teks apa pun, seketika dan sepenuhnya di browser Anda — tidak ada yang diunggah.',
    input: 'Teks untuk di-hash',
    placeholder: 'Ketik atau tempel teks…',
    empty: 'Masukkan teks untuk melihat hash-nya.',
    uppercase: 'Huruf besar',
  },
};

export default function HashText({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [text, setText] = useState('');
  const [hashes, setHashes] = useState<Record<HashAlgo, string> | null>(null);
  const [upper, setUpper] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!text) { setHashes(null); return; }
    hashAll(text).then(h => { if (!cancelled) setHashes(h); });
    return () => { cancelled = true; };
  }, [text]);

  const format = (h: string) => (upper ? h.toUpperCase() : h);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="space-y-1">
        <span className="block text-sm font-semibold">{t.input}</span>
        <TextArea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder={t.placeholder} />
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={upper} onChange={e => setUpper(e.target.checked)} className="h-4 w-4 accent-accent" />
        {t.uppercase}
      </label>

      {!hashes && <p className="text-sm text-muted-foreground">{t.empty}</p>}

      {hashes && (
        <div className="divide-y divide-border border-2 border-border">
          {HASH_ALGOS.map(a => (
            <div key={a.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="w-24 shrink-0 font-bold">{a.label}</span>
              <span className="min-w-0 flex-1 break-all font-mono text-muted-foreground">{format(hashes[a.key])}</span>
              <CopyButton value={format(hashes[a.key])} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
