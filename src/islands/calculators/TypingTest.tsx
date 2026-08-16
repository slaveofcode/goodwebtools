import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { typingStats } from '@/tools/calculators/typing.lib';
import type { Lang } from '@/i18n/config';

const PASSAGES: Record<Lang, string[]> = {
  en: [
    'The quick brown fox jumps over the lazy dog while the sun sets slowly behind the quiet hills.',
    'Typing well is less about speed and more about rhythm, accuracy, and keeping your eyes on the screen.',
    'A small river winds through the valley, past old stone bridges and fields that turn gold in autumn.',
    'Good habits are built one day at a time, so practice a little every morning and progress will follow.',
  ],
  id: [
    'Rubah cokelat yang gesit melompati anjing yang malas saat matahari perlahan tenggelam di balik bukit.',
    'Mengetik dengan baik bukan soal kecepatan semata, tetapi tentang irama, ketepatan, dan fokus pada layar.',
    'Sebuah sungai kecil berkelok melewati lembah, jembatan batu tua, dan sawah yang menguning saat kemarau.',
    'Kebiasaan baik dibangun sedikit demi sedikit, jadi berlatihlah setiap pagi dan kemajuan akan mengikuti.',
  ],
};

const TR: Record<Lang, {
  intro: string; start: string; restart: string; newText: string;
  wpm: string; accuracy: string; time: string; chars: string; finished: string; hint: string;
}> = {
  en: {
    intro: 'Test your typing speed and accuracy. Start typing the text below — the timer begins on your first keystroke and your words-per-minute and accuracy update live. Nothing is uploaded.',
    start: 'Start typing below', restart: 'Try again', newText: 'New text',
    wpm: 'WPM', accuracy: 'Accuracy', time: 'Time', chars: 'Characters', finished: 'Done!',
    hint: 'Pasting is disabled — type it out to get a real score.',
  },
  id: {
    intro: 'Uji kecepatan dan ketepatan mengetik Anda. Mulai ketik teks di bawah — timer dimulai pada ketukan pertama dan kata per menit serta akurasi diperbarui langsung. Tidak ada yang diunggah.',
    start: 'Mulai ketik di bawah', restart: 'Coba lagi', newText: 'Teks baru',
    wpm: 'KPM', accuracy: 'Akurasi', time: 'Waktu', chars: 'Karakter', finished: 'Selesai!',
    hint: 'Menempel dinonaktifkan — ketik langsung untuk skor yang benar.',
  },
};

export default function TypingTest({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const l: Lang = lang === 'id' ? 'id' : 'en';
  const pool = PASSAGES[l] ?? PASSAGES.en;

  const [idx, setIdx] = useState(() => Math.floor(Math.random() * pool.length));
  const passage = pool[idx];
  const [typed, setTyped] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const finished = endTime !== null;

  // Tick for live stats while typing.
  useEffect(() => {
    if (startTime === null || finished) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startTime, finished]);

  const elapsedMs = startTime === null ? 0 : (endTime ?? (now || Date.now())) - startTime;
  const stats = useMemo(() => typingStats(passage, typed, elapsedMs), [passage, typed, elapsedMs]);

  const reset = (newIdx = idx) => {
    setIdx(newIdx);
    setTyped('');
    setStartTime(null);
    setEndTime(null);
    setNow(0);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (finished) return;
    const value = e.target.value.slice(0, passage.length);
    if (startTime === null && value.length > 0) setStartTime(Date.now());
    setTyped(value);
    if (value.length >= passage.length) setEndTime(Date.now());
  };

  const seconds = (elapsedMs / 1000).toFixed(1);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { l: t.wpm, v: String(stats.wpm) },
          { l: t.accuracy, v: `${stats.accuracy}%` },
          { l: t.time, v: `${seconds}s` },
          { l: t.chars, v: `${typed.length}/${passage.length}` },
        ].map(x => (
          <div key={x.l} className="border-2 border-border p-2 text-center">
            <div className="text-2xl font-black tabular-nums">{x.v}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{x.l}</div>
          </div>
        ))}
      </div>

      <div
        onClick={() => taRef.current?.focus()}
        className="cursor-text select-none whitespace-pre-wrap break-words border-2 border-border p-4 font-mono text-lg leading-relaxed">
        {passage.split('').map((ch, i) => {
          let cls = 'text-muted-foreground';
          if (i < typed.length) cls = typed[i] === ch ? 'text-green-600 dark:text-green-400' : 'bg-red-500/40 text-red-700 dark:text-red-300';
          const cursor = i === typed.length && !finished ? ' border-l-2 border-accent' : '';
          return <span key={i} className={`${cls}${cursor}`}>{ch}</span>;
        })}
      </div>

      <textarea
        ref={taRef}
        value={typed}
        onChange={onChange}
        onPaste={e => e.preventDefault()}
        disabled={finished}
        autoFocus
        rows={3}
        aria-label={t.start}
        placeholder={t.start}
        className="w-full resize-none border-2 border-border bg-muted p-3 font-mono text-sm disabled:opacity-60"
      />

      <div className="flex flex-wrap items-center gap-2">
        {finished && <span className="text-sm font-black text-green-600 dark:text-green-400">{t.finished}</span>}
        <Button onClick={() => reset()}>{t.restart}</Button>
        <Button variant="secondary" onClick={() => reset((idx + 1) % pool.length)}>{t.newText}</Button>
        <span className="text-xs text-muted-foreground">{t.hint}</span>
      </div>
    </div>
  );
}
