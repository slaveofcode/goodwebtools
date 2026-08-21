import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Lightbulb, Shuffle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useExpand } from '@/hooks/useExpand';
import {
  DIFFICULTIES, createBoard, findPath, findHint, hasAnyMove, removePair,
  shuffleBoard, tilesLeft, isSolved, pairScore, posEq,
  type Grid, type Pos, type Difficulty,
} from '@/tools/games/onet.lib';
import type { Lang } from '@/i18n/config';

/** 24 tiles chosen to stay distinct at small size (different colours + shapes). */
const TILES = [
  '🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🍍', '🥝',
  '🐶', '🐱', '🐸', '🐵', '🐼', '🦊', '🐨', '🦁',
  '🌸', '🌻', '🌵', '🍀', '⭐', '⚡', '🔔', '🎈',
];

const BEST_KEY = 'gwt-onet-best';
const TIMED_SECONDS: Record<string, number> = { easy: 180, normal: 300, hard: 420 };

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Match pairs of identical tiles that can be joined by a line with at most two turns — the line may also travel around the outside of the board. Clear every tile to win.',
    relaxed: 'Relaxed', timed: 'Timed', hint: 'Hint', shuffle: 'Shuffle', newGame: 'New game',
    left: 'Tiles left', time: 'Time', best: 'Best', score: 'Score', expand: 'Expand', exit: 'Exit',
    won: 'Board cleared! 🎉', lost: 'Time’s up!', noMoves: 'No moves left — shuffling…',
    easy: 'Easy', normal: 'Normal', hard: 'Hard',
    hintUsed: 'Hints used', tapHint: 'Tap two matching tiles.',
  },
  id: {
    intro: 'Cocokkan pasangan ubin identik yang bisa dihubungkan garis dengan maksimal dua belokan — garisnya juga boleh lewat di luar papan. Habiskan semua ubin untuk menang.',
    relaxed: 'Santai', timed: 'Berwaktu', hint: 'Petunjuk', shuffle: 'Acak', newGame: 'Main baru',
    left: 'Sisa ubin', time: 'Waktu', best: 'Terbaik', score: 'Skor', expand: 'Perbesar', exit: 'Keluar',
    won: 'Papan bersih! 🎉', lost: 'Waktu habis!', noMoves: 'Tidak ada langkah — mengacak…',
    easy: 'Mudah', normal: 'Normal', hard: 'Sulit',
    hintUsed: 'Petunjuk dipakai', tapHint: 'Ketuk dua ubin yang sama.',
  },
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;

const emptyGrid = (d: Difficulty): Grid =>
  Array.from({ length: d.rows }, () => Array<number>(d.cols).fill(0));

export default function OnetGame({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const { ref: stageRef, expanded, enter, exit } = useExpand<HTMLDivElement>();

  const [diff, setDiff] = useState<Difficulty>(DIFFICULTIES[1]);
  const [timed, setTimed] = useState(false);
  // Start with a deterministic empty board: dealing a random one here would
  // differ between the server render and the client, causing a hydration
  // mismatch. The real board is dealt on mount.
  const [grid, setGrid] = useState<Grid>(() => emptyGrid(DIFFICULTIES[1]));
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<Pos | null>(null);
  const [pathPx, setPathPx] = useState<{ x: number; y: number }[] | null>(null);
  const [hintPair, setHintPair] = useState<[Pos, Pos] | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [notice, setNotice] = useState('');
  const [best, setBest] = useState<Record<string, number>>({});

  const pathTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  /**
   * Convert board cells to pixel centres inside the grid, measured from the
   * real cells so gaps/padding/board size can't push the line out of line.
   * Handles the one-cell margin (r or c of -1 / rows / cols) by extrapolating
   * from the measured cell pitch.
   */
  const toPixels = useCallback((pts: Pos[], cols: number): { x: number; y: number }[] | null => {
    const el = gridRef.current;
    const cells = el?.querySelectorAll<HTMLElement>(':scope > button');
    if (!el || !cells || cells.length < cols + 2) return null;
    const first = cells[0];
    const pitchX = cells[1].offsetLeft - first.offsetLeft;
    const pitchY = cells[cols].offsetTop - first.offsetTop;
    const w = first.offsetWidth;
    const h = first.offsetHeight;
    return pts.map((p) => ({
      x: first.offsetLeft + p.c * pitchX + w / 2,
      y: first.offsetTop + p.r * pitchY + h / 2,
    }));
  }, []);

  useEffect(() => {
    try { setBest(JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}')); } catch { /* blocked */ }
    setGrid(createBoard(DIFFICULTIES[1]));
    setReady(true);
    return () => {
      if (pathTimer.current) clearTimeout(pathTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const limit = TIMED_SECONDS[diff.id] ?? 300;
  const remaining = Math.max(0, limit - elapsed);

  // Clock: counts up in relaxed mode, down in timed mode.
  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (timed && status === 'playing' && remaining <= 0) setStatus('lost');
  }, [timed, remaining, status]);

  const saveBest = useCallback((secs: number) => {
    setBest((prev) => {
      const key = `${diff.id}${timed ? '-timed' : ''}`;
      if (prev[key] !== undefined && prev[key] <= secs) return prev;
      const next = { ...prev, [key]: secs };
      try { localStorage.setItem(BEST_KEY, JSON.stringify(next)); } catch { /* blocked */ }
      return next;
    });
  }, [diff.id, timed]);

  const start = useCallback((d: Difficulty, useTimer: boolean) => {
    setReady(true);
    if (pathTimer.current) clearTimeout(pathTimer.current);
    setGrid(createBoard(d));
    setDiff(d);
    setTimed(useTimer);
    setSelected(null);
    setPathPx(null);
    setHintPair(null);
    setScore(0);
    setStreak(0);
    setHintsUsed(0);
    setElapsed(0);
    setStatus('playing');
    setNotice('');
  }, []);

  const flashNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 1600);
  };

  /** After a removal: win, or reshuffle when the board has no legal move. */
  const settle = useCallback((next: Grid, secs: number) => {
    if (isSolved(next)) {
      setStatus('won');
      saveBest(secs);
      return next;
    }
    if (!hasAnyMove(next)) {
      flashNotice(t.noMoves);
      return shuffleBoard(next);
    }
    return next;
  }, [saveBest, t.noMoves]);

  const tap = (r: number, c: number) => {
    if (status !== 'playing' || grid[r][c] === 0) return;
    const here: Pos = { r, c };
    setHintPair(null);

    if (!selected) { setSelected(here); return; }
    if (posEq(selected, here)) { setSelected(null); return; }

    // Tapping a different symbol just moves the selection.
    if (grid[selected.r][selected.c] !== grid[r][c]) { setSelected(here); return; }

    const found = findPath(grid, selected, here);
    if (!found) { setSelected(here); setStreak(0); return; }

    // Show the connecting line, then clear the pair once it has been seen.
    setPathPx(toPixels(found, diff.cols));
    const cleared = removePair(grid, selected, here);
    setSelected(null);
    const nextStreak = streak + 1;
    setStreak(nextStreak);
    setScore((s) => s + pairScore(nextStreak));
    if (pathTimer.current) clearTimeout(pathTimer.current);
    pathTimer.current = setTimeout(() => {
      setPathPx(null);
      setGrid(settle(cleared, elapsed));
    }, 420);
  };

  const useHint = () => {
    if (status !== 'playing') return;
    const found = findHint(grid);
    if (!found) { flashNotice(t.noMoves); setGrid(shuffleBoard(grid)); return; }
    setHintPair(found);
    setHintsUsed((n) => n + 1);
    setScore((s) => Math.max(0, s - 5));
  };

  const doShuffle = () => {
    if (status !== 'playing') return;
    setSelected(null);
    setGrid(shuffleBoard(grid));
    setScore((s) => Math.max(0, s - 10));
  };

  const isHinted = (r: number, c: number) =>
    !!hintPair && (posEq(hintPair[0], { r, c }) || posEq(hintPair[1], { r, c }));

  const bestKey = `${diff.id}${timed ? '-timed' : ''}`;
  const bestTime = best[bestKey];

  const seg = (active: boolean) =>
    `border-2 px-3 py-1 text-sm font-medium transition-all ${
      active ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border hover:shadow-brutal'
    }`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div
        ref={stageRef}
        className={expanded
          ? 'fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 overflow-auto bg-background p-3'
          : 'space-y-3'}
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} onClick={() => start(d, timed)} aria-pressed={diff.id === d.id} className={seg(diff.id === d.id)}>
              {t[d.id]}
            </button>
          ))}
          <button onClick={() => start(diff, false)} aria-pressed={!timed} className={seg(!timed)}>{t.relaxed}</button>
          <button onClick={() => start(diff, true)} aria-pressed={timed} className={seg(timed)}>{t.timed}</button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          <span className="border-2 border-border px-3 py-1">
            <span className="text-muted-foreground">{t.left}:</span> <span className="font-black tabular-nums">{tilesLeft(grid)}</span>
          </span>
          <span className="border-2 border-border px-3 py-1">
            <span className="text-muted-foreground">{t.score}:</span> <span className="font-black tabular-nums">{score}</span>
          </span>
          <span className={`border-2 px-3 py-1 ${timed && remaining <= 30 ? 'border-red-500 text-red-600 dark:text-red-400' : 'border-border'}`}>
            <span className="text-muted-foreground">{t.time}:</span>{' '}
            <span className="font-black tabular-nums">{fmt(timed ? remaining : elapsed)}</span>
          </span>
          {bestTime !== undefined && (
            <span className="border-2 border-border px-3 py-1">
              <span className="text-muted-foreground">{t.best}:</span> <span className="font-black tabular-nums">{fmt(bestTime)}</span>
            </span>
          )}
        </div>

        {timed && (
          <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${remaining <= 30 ? 'bg-red-500' : 'bg-accent'}`}
              style={{ width: `${(remaining / limit) * 100}%` }}
            />
          </div>
        )}

        <div className="relative w-full" style={{ maxWidth: expanded ? 'min(96vw, 60rem)' : '34rem' }}>
          <div
            ref={gridRef}
            className="relative grid gap-[2px] border-2 border-border bg-muted p-[2px]"
            style={{ gridTemplateColumns: `repeat(${diff.cols}, minmax(0, 1fr))` }}
          >
            {grid.map((row, r) =>
              row.map((v, c) => {
                const sel = selected && posEq(selected, { r, c });
                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => tap(r, c)}
                    disabled={v === 0 || status !== 'playing'}
                    aria-label={v === 0 ? 'empty' : `tile ${v}`}
                    className={`flex aspect-square select-none items-center justify-center border-2 text-[clamp(0.75rem,4vw,1.5rem)] leading-none transition-colors ${
                      v === 0
                        ? 'border-transparent bg-transparent'
                        : sel
                          ? 'border-accent bg-accent/20 shadow-brutal-sm'
                          : isHinted(r, c)
                            ? 'border-emerald-500 bg-emerald-500/20'
                            : 'border-border bg-background hover:bg-muted'
                    }`}
                  >
                    {v === 0 ? '' : TILES[(v - 1) % TILES.length]}
                  </button>
                );
              }),
            )}

            {/* Connecting line. Drawn in the grid's own pixel space (no
                viewBox) from measured cell positions, so it lines up exactly
                whatever the board size, gap or padding — and overflow-visible
                lets routes that leave the board still show. */}
            {pathPx && pathPx.length > 1 && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                {/* Dark halo first so the line reads on any tile colour. */}
                <polyline
                  points={pathPx.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={9}
                  strokeLinecap="round" strokeLinejoin="round"
                />
                <polyline
                  points={pathPx.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none" stroke="rgb(52,211,153)" strokeWidth={5}
                  strokeLinecap="round" strokeLinejoin="round"
                />
                {[pathPx[0], pathPx[pathPx.length - 1]].map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={6} fill="rgb(52,211,153)" stroke="rgba(0,0,0,0.55)" strokeWidth={2} />
                ))}
              </svg>
            )}

            {ready && status !== 'playing' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/60 text-center text-white">
                <span className="text-2xl font-black">{status === 'won' ? t.won : t.lost}</span>
                <span className="text-sm">{t.score}: {score} · {t.time}: {fmt(timed ? limit - remaining : elapsed)}</span>
                <Button onClick={() => start(diff, timed)}>{t.newGame}</Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="secondary" onClick={useHint} disabled={status !== 'playing'}>
            <Lightbulb className="h-4 w-4" /> {t.hint}
          </Button>
          <Button variant="secondary" onClick={doShuffle} disabled={status !== 'playing'}>
            <Shuffle className="h-4 w-4" /> {t.shuffle}
          </Button>
          <Button onClick={() => start(diff, timed)}><RotateCcw className="h-4 w-4" /> {t.newGame}</Button>
          <Button variant="secondary" onClick={(e) => { e.currentTarget.blur(); if (expanded) exit(); else enter(); }}>
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {expanded ? t.exit : t.expand}
          </Button>
        </div>

        <p className="min-h-[1.25rem] text-center text-xs text-muted-foreground">
          {notice || (hintsUsed > 0 ? `${t.hintUsed}: ${hintsUsed}` : t.tapHint)}
        </p>
      </div>
    </div>
  );
}
