import { useMemo, useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { countText } from '@/tools/dev/text.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string;
  placeholder: string;
  words: string;
  characters: string;
  charactersNoSpaces: string;
  sentences: string;
  paragraphs: string;
  lines: string;
  reading: string;
  min: string;
}> = {
  en: {
    intro: 'Count words, characters, sentences, paragraphs and reading time as you type. Everything runs in your browser — nothing is uploaded.',
    placeholder: 'Type or paste your text…',
    words: 'Words', characters: 'Characters', charactersNoSpaces: 'Characters (no spaces)',
    sentences: 'Sentences', paragraphs: 'Paragraphs', lines: 'Lines', reading: 'Reading time', min: 'min',
  },
  id: {
    intro: 'Hitung kata, karakter, kalimat, paragraf, dan waktu baca saat Anda mengetik. Semuanya berjalan di browser Anda — tidak ada yang diunggah.',
    placeholder: 'Ketik atau tempel teks Anda…',
    words: 'Kata', characters: 'Karakter', charactersNoSpaces: 'Karakter (tanpa spasi)',
    sentences: 'Kalimat', paragraphs: 'Paragraf', lines: 'Baris', reading: 'Waktu baca', min: 'mnt',
  },
};

export default function WordCounter({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [text, setText] = useState('');
  const stats = useMemo(() => countText(text), [text]);

  const readMin = stats.readingMinutes < 1 && stats.words > 0
    ? '< 1'
    : String(Math.round(stats.readingMinutes));

  const cards = [
    { label: t.words, value: stats.words.toLocaleString() },
    { label: t.characters, value: stats.characters.toLocaleString() },
    { label: t.charactersNoSpaces, value: stats.charactersNoSpaces.toLocaleString() },
    { label: t.sentences, value: stats.sentences.toLocaleString() },
    { label: t.paragraphs, value: stats.paragraphs.toLocaleString() },
    { label: t.lines, value: stats.lines.toLocaleString() },
    { label: t.reading, value: `${readMin} ${t.min}` },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {cards.map(c => (
          <div key={c.label} className="border-2 border-border bg-muted p-3 text-center">
            <div className="text-2xl font-bold tabular-nums">{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <TextArea value={text} onChange={e => setText(e.target.value)} rows={12} placeholder={t.placeholder} monospace={false} />
    </div>
  );
}
