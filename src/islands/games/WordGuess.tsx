import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import { Button } from '@/components/ui/Button';
import {
  evaluateGuess,
  dayIndex,
  puzzleNumber,
  dailyAnswer,
  practiceAnswer,
  updateStats,
  buildShareText,
  keyboardStates,
  type Stats,
  type LetterState,
} from '@/tools/games/wordguess.lib';
import { wordSets } from '@/tools/games/wordguess.words';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'A new 5-letter word puzzle every day — right in your browser, in English or Bahasa. Six tries, color clues, and a streak to keep alive. Nothing is uploaded and it works offline.',
    daily: 'Daily', practice: 'Practice', practiceTitle: 'Practice — random word', streak: 'Streak',
    notEnough: 'Not enough letters', notInList: 'Not in word list', win: 'Splendid!', lose: 'The word was',
    guessed: 'You already finished today — come back tomorrow for a new word.', nextIn: 'Next puzzle in',
    stats: 'Statistics', played: 'Played', winPct: 'Win %', maxStreak: 'Max streak', distribution: 'Guess distribution',
    share: 'Share result', playAgain: 'Play another (practice)',
    howToHint: 'Guess the word in 6 tries. Green = right spot, yellow = wrong spot, gray = not in the word.',
  },
  id: {
    intro: 'Teka-teki kata 5 huruf baru setiap hari — langsung di browser Anda, dalam bahasa Inggris atau Indonesia. Enam kesempatan, petunjuk warna, dan streak yang harus dijaga. Tidak ada yang diunggah dan bisa dipakai offline.',
    daily: 'Harian', practice: 'Latihan', practiceTitle: 'Latihan — kata acak', streak: 'Streak',
    notEnough: 'Hurufnya belum cukup', notInList: 'Tidak ada dalam daftar kata', win: 'Luar biasa!', lose: 'Katanya adalah',
    guessed: 'Anda sudah menyelesaikan teka-teki hari ini — kembali besok untuk kata baru.', nextIn: 'Teka-teki berikutnya dalam',
    stats: 'Statistik', played: 'Dimainkan', winPct: '% menang', maxStreak: 'Streak terpanjang', distribution: 'Distribusi tebakan',
    share: 'Bagikan hasil', playAgain: 'Main lagi (latihan)',
    howToHint: 'Tebak kata dalam 6 kesempatan. Hijau = posisi benar, kuning = posisi salah, abu-abu = tidak ada dalam kata.',
  },
};

const ROWS = 6;

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const TILE_STYLE: Record<LetterState | 'empty' | 'pending', string> = {
  empty: 'border-2 border-border/40 bg-muted text-foreground',
  pending: 'border-2 border-border bg-muted text-foreground',
  correct: 'border-2 border-border bg-emerald-500 text-white',
  present: 'border-2 border-border bg-yellow-400 text-black',
  absent: 'border-2 border-border bg-stone-500 text-white',
};

const KEY_STYLE: Record<LetterState, string> = {
  correct: 'bg-emerald-500 text-white',
  present: 'bg-yellow-400 text-black',
  absent: 'bg-stone-500 text-white',
};

const KEYFRAMES = `
@keyframes gwtwg-shake { 0%,100% { translate: 0; } 20% { translate: -4px 0; } 40% { translate: 4px 0; } 60% { translate: -3px 0; } 80% { translate: 3px 0; } }
@keyframes gwtwg-pop { 0% { scale: 1; } 60% { scale: 1.12; } 100% { scale: 1; } }
@keyframes gwtwg-flip { 0% { transform: rotateX(0); } 49% { transform: rotateX(90deg); } 50% { transform: rotateX(90deg); } 100% { transform: rotateX(0); } }
.gwtwg-shake { animation: gwtwg-shake 300ms ease-in-out; }
.gwtwg-pop { animation: gwtwg-pop 140ms ease-out; }
.gwtwg-flip { animation: gwtwg-flip 500ms ease; }
@media (prefers-reduced-motion: reduce) {
  .gwtwg-shake, .gwtwg-pop, .gwtwg-flip { animation: none; }
}
`;

interface DailyState {
  day: number;
  guesses: string[];
  status: 'playing' | 'won' | 'lost';
}

interface PracticeState {
  answer: string;
  guesses: string[];
  status: 'playing' | 'won' | 'lost';
}

const statsKey = (lang: Lang) => `gwt-wordguess-stats-${lang}-v1`;
const stateKey = (lang: Lang) => `gwt-wordguess-state-${lang}-v1`;

function fmtCountdown(ms: number): string {
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

export default function WordGuess({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const { answers, valid } = useMemo(() => wordSets(lang), [lang]);
  const today = useMemo(() => dayIndex(), []);
  const puzzle = puzzleNumber(today);

  // Practice and daily share the answer logic; only the daily persists.
  const [mode, setMode] = useState<'daily' | 'practice'>('daily');
  const [daily, setDaily] = useState<DailyState>({ day: today, guesses: [], status: 'playing' });
  const [practice, setPractice] = useState<PracticeState | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState('');
  const [shake, setShake] = useState(false);
  const [revealRow, setRevealRow] = useState(-1);
  const [countdown, setCountdown] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);

  const answer = mode === 'daily' ? dailyAnswer(today, answers) : (practice?.answer ?? '');
  const active = mode === 'daily' ? daily : practice ?? { guesses: [], status: 'playing' as const };
  const guesses = active.guesses;
  const status = active.status;
  const finished = mode === 'daily' && daily.status !== 'playing';

  // Hydrate persisted daily state + stats on mount (never during SSR).
  useEffect(() => {
    try {
      const rawState = localStorage.getItem(stateKey(lang));
      if (rawState) {
        const parsed = JSON.parse(rawState) as DailyState;
        if (parsed.day === today) setDaily(parsed);
      }
      const rawStats = localStorage.getItem(statsKey(lang));
      if (rawStats) setStats(JSON.parse(rawStats) as Stats);
    } catch { /* blocked or corrupt */ }
  }, [lang, today]);

  const persistDaily = useCallback((next: DailyState) => {
    setDaily(next);
    try { localStorage.setItem(stateKey(lang), JSON.stringify(next)); } catch { /* blocked */ }
  }, [lang]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 1600);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // Countdown to the next UTC midnight while the daily is finished.
  useEffect(() => {
    if (!finished) return;
    const tick = () => {
      const next = (today + 1) * 86_400_000;
      setCountdown(fmtCountdown(next - Date.now()));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [finished, today]);

  const submit = useCallback((word: string) => {
    if (status !== 'playing') return;
    if (word.length < 5) {
      setShake(true);
      window.setTimeout(() => setShake(false), 320);
      showToast(t.notEnough);
      return;
    }
    if (!valid.has(word)) {
      setShake(true);
      window.setTimeout(() => setShake(false), 320);
      showToast(t.notInList);
      return;
    }

    const nextGuesses = [...guesses, word];
    setDraft('');
    setRevealRow(guesses.length);
    const won = word === answer;
    const lost = !won && nextGuesses.length >= ROWS;

    if (mode === 'daily') {
      const next: DailyState = { day: today, guesses: nextGuesses, status: won ? 'won' : lost ? 'lost' : 'playing' };
      persistDaily(next);
      if (won || lost) {
        const base: Stats = stats ?? { played: 0, wins: 0, streak: 0, maxStreak: 0, distribution: [0, 0, 0, 0, 0, 0] };
        const nextStats = updateStats(base, won, nextGuesses.length);
        setStats(nextStats);
        try { localStorage.setItem(statsKey(lang), JSON.stringify(nextStats)); } catch { /* blocked */ }
      }
    } else if (practice) {
      setPractice({ ...practice, guesses: nextGuesses, status: won ? 'won' : lost ? 'lost' : 'playing' });
    }

    window.setTimeout(() => showToast(won ? t.win : lost ? `${t.lose} ${answer.toUpperCase()}` : ''), 550);
  }, [status, valid, guesses, answer, mode, practice, persistDaily, stats, today, lang, showToast, t]);

  // Physical keyboard input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') { submit(draft); return; }
      if (e.key === 'Backspace') { setDraft(d => d.slice(0, -1)); return; }
      if (/^[a-zA-Z]$/.test(e.key) && status === 'playing') setDraft(d => (d.length < 5 ? d + e.key.toLowerCase() : d));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, status, submit]);

  const onScreenKey = (key: 'ENTER' | 'DEL' | string) => {
    if (key === 'ENTER') { submit(draft); return; }
    if (key === 'DEL') { setDraft(d => d.slice(0, -1)); return; }
    if (status === 'playing') setDraft(d => (d.length < 5 ? d + key : d));
  };

  const keyStates = useMemo(() => keyboardStates(guesses, answer), [guesses, answer]);

  const statesGrid: (LetterState | null)[][] = useMemo(
    () => guesses.map(g => evaluateGuess(g, answer)),
    [guesses, answer],
  );

  const startPractice = () => {
    setPractice({ answer: practiceAnswer(answers), guesses: [], status: 'playing' });
    setMode('practice');
    setDraft('');
    setToast('');
  };

  const backToDaily = () => {
    setMode('daily');
    setDraft('');
    setToast('');
  };

  const shareText = status !== 'playing'
    ? buildShareText(statesGrid as LetterState[][], status === 'won', guesses.length, mode === 'daily' ? puzzle : 0)
    : '';

  const distMax = stats ? Math.max(1, ...stats.distribution) : 1;

  return (
    <div className="space-y-4">
      <style>{KEYFRAMES}</style>
      <p className="text-sm text-muted-foreground max-w-2xl">{t.intro}</p>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {mode === 'daily' ? `${t.daily} · #${puzzle}` : t.practiceTitle}
        </span>
        {mode === 'practice'
          ? <Button variant="ghost" className="px-2 py-1 text-xs" onClick={backToDaily}>{t.daily}</Button>
          : <Button variant="ghost" className="px-2 py-1 text-xs" onClick={startPractice}>{t.practice}</Button>}
      </div>

      <div className="relative">
        <div className="mx-auto grid w-full max-w-[330px] grid-rows-6 gap-1.5" aria-label="word grid">
          {Array.from({ length: ROWS }, (_, r) => {
            const word = guesses[r] ?? (r === guesses.length ? draft.padEnd(5) : '     ');
            const revealed = r < guesses.length;
            const flipClass = revealed && r === revealRow ? 'gwtwg-flip' : '';
            return (
              <div key={r} className={`grid grid-cols-5 gap-1.5 ${shake && r === guesses.length ? 'gwtwg-shake' : ''}`}>
                {Array.from({ length: 5 }, (_, c) => {
                  const ch = word[c];
                  const st: LetterState | 'empty' | 'pending' = revealed
                    ? statesGrid[r]![c]!
                    : ch === ' ' ? 'empty' : 'pending';
                  return (
                    <div
                      key={c}
                      className={`flex aspect-square items-center justify-center border-2 text-2xl font-extrabold uppercase ${TILE_STYLE[st]} ${flipClass} ${!revealed && ch !== ' ' && c === draft.length - 1 ? 'gwtwg-pop' : ''}`}
                      style={revealed ? { animationDelay: `${c * 90}ms` } : undefined}
                    >
                      {ch === ' ' ? '' : ch}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {toast && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <div className="border-2 border-border bg-foreground px-4 py-2 text-sm font-bold text-background shadow-brutal">
              {toast}
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-[400px] flex-col gap-1.5 select-none">
        {KEY_ROWS.map((row, i) => (
          <div key={i} className="flex justify-center gap-1">
            {i === 2 && (
              <button
                type="button"
                className="border-2 border-border bg-muted px-2.5 text-xs font-bold uppercase shadow-brutal-sm press-brutal"
                onClick={() => onScreenKey('ENTER')}
                aria-label="Enter"
              >
                ⏎
              </button>
            )}
            {row.split('').map(k => (
              <button
                key={k}
                type="button"
                className={`h-11 flex-1 border-2 border-border text-sm font-bold uppercase shadow-brutal-sm press-brutal ${keyStates[k] ? KEY_STYLE[keyStates[k]] : 'bg-muted'}`}
                onClick={() => onScreenKey(k)}
                aria-label={`letter ${k}`}
              >
                {k}
              </button>
            ))}
            {i === 2 && (
              <button
                type="button"
                className="border-2 border-border bg-muted px-2.5 text-xs font-bold uppercase shadow-brutal-sm press-brutal"
                onClick={() => onScreenKey('DEL')}
                aria-label="Backspace"
              >
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>

      {finished && mode === 'daily' && (
        <div className="border-2 border-border bg-muted p-4 shadow-brutal space-y-4" data-testid="wg-end-panel">
          <p className="text-sm font-bold">
            {daily.status === 'won' ? t.win : `${t.lose} ${answer.toUpperCase()}.`}
          </p>
          <p className="text-xs text-muted-foreground">{t.guessed} {t.nextIn} <span className="font-mono">{countdown}</span></p>

          {stats && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide">{t.stats}</p>
              <div className="flex gap-4 text-center text-sm">
                <div><div className="text-xl font-extrabold">{stats.played}</div>{t.played}</div>
                <div><div className="text-xl font-extrabold">{stats.played ? Math.round(100 * stats.wins / stats.played) : 0}</div>{t.winPct}</div>
                <div><div className="text-xl font-extrabold">{stats.streak}</div>{t.streak}</div>
                <div><div className="text-xl font-extrabold">{stats.maxStreak}</div>{t.maxStreak}</div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wide">{t.distribution}</p>
                {stats.distribution.map((n, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-3 font-bold">{i + 1}</span>
                    <div className="h-4 border-2 border-border bg-foreground" style={{ width: `${Math.max(8, (100 * n) / distMax)}%`, minWidth: '1.75rem' }}>
                      <span className="px-1 text-background font-bold leading-4">{n}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <CopyButton value={shareText} label={t.share} />
            <Button variant="secondary" onClick={startPractice}>{t.playAgain}</Button>
          </div>
        </div>
      )}

      {mode === 'practice' && practice && practice.status !== 'playing' && (
        <div className="border-2 border-border bg-muted p-4 shadow-brutal space-y-3" data-testid="wg-end-panel">
          <p className="text-sm font-bold">
            {practice.status === 'won' ? t.win : `${t.lose} ${practice.answer.toUpperCase()}.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={startPractice}>{t.playAgain}</Button>
            <Button variant="ghost" onClick={backToDaily}>{t.daily}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
