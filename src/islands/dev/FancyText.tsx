import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { CopyButton } from '@/components/ui/CopyButton';
import { allStyles } from '@/tools/dev/fancytext.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Turn plain text into fancy Unicode styles for bios, usernames and posts. These are real Unicode characters, so they paste anywhere — Instagram, TikTok, Discord and more.',
    placeholder: 'Type your text…', copy: 'Copy',
  },
  id: {
    intro: 'Ubah teks biasa menjadi gaya Unicode keren untuk bio, username, dan postingan. Ini karakter Unicode asli, jadi bisa ditempel di mana saja — Instagram, TikTok, Discord, dan lainnya.',
    placeholder: 'Ketik teks Anda…', copy: 'Salin',
  },
};

export default function FancyText({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [text, setText] = useState('Hello world');
  const styles = allStyles(text || '');

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      <TextArea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder={t.placeholder} />

      <ul className="divide-y-2 divide-border border-2 border-border">
        {styles.map(s => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="truncate text-lg" title={s.output}>{s.output || ' '}</div>
            </div>
            <CopyButton value={s.output} label={t.copy} disabled={!s.output} />
          </li>
        ))}
      </ul>
    </div>
  );
}
