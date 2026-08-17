import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { move, emptyCells, emptyGrid, hasMoves, maxTile, bestMove, type Grid, type Direction } from '@/tools/games/game2048.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Play 2048 — combine tiles to reach 2048. Use arrow keys or swipe. Includes cheats: Undo and an Auto-play that simulates the best moves for you.',
    score: 'Score', newGame: 'New game', undo: 'Undo', auto: 'Auto-play (cheat)', stop: 'Stop', won: 'You made 2048! 🎉', over: 'Game over', keepGoing: 'Keep going',
    hint: 'Arrow keys or swipe to move.',
  },
  id: {
    intro: 'Main 2048 — gabungkan ubin untuk mencapai 2048. Pakai tombol panah atau geser. Termasuk cheat: Urungkan dan Auto-play yang mensimulasikan langkah terbaik untuk Anda.',
    score: 'Skor', newGame: 'Main baru', undo: 'Urungkan', auto: 'Auto-play (cheat)', stop: 'Berhenti', won: 'Anda mencapai 2048! 🎉', over: 'Permainan selesai', keepGoing: 'Lanjutkan',
    hint: 'Tombol panah atau geser untuk bergerak.',
  },
};

const TILE_COLORS: Record<number, string> = {
  2: 'bg-stone-200 text-stone-800', 4: 'bg-stone-300 text-stone-800',
  8: 'bg-orange-300 text-white', 16: 'bg-orange-400 text-white',
  32: 'bg-orange-500 text-white', 64: 'bg-red-500 text-white',
  128: 'bg-yellow-400 text-white', 256: 'bg-yellow-500 text-white',
  512: 'bg-lime-500 text-white', 1024: 'bg-emerald-500 text-white',
  2048: 'bg-fuchsia-600 text-white',
};

function spawn(grid: Grid): Grid {
  const cells = emptyCells(grid);
  if (!cells.length) return grid;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  const ng = grid.map(row => [...row]);
  ng[r][c] = Math.random() < 0.9 ? 2 : 4;
  return ng;
}

function fresh(): Grid { return spawn(spawn(emptyGrid())); }

export default function Game2048({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [grid, setGrid] = useState<Grid>(fresh);
  const [score, setScore] = useState(0);
  const [won, setWon] = useState(false);
  const [over, setOver] = useState(false);
  const [auto, setAuto] = useState(false);
  const [history, setHistory] = useState<{ grid: Grid; score: number }[]>([]);

  const latest = useRef({ grid, score, over });
  latest.current = { grid, score, over };

  const doMove = useCallback((dir: Direction | null) => {
    const cur = latest.current;
    if (cur.over || !dir) return;
    const r = move(cur.grid, dir);
    if (!r.moved) return;
    const ng = spawn(r.grid);
    setHistory(h => [...h.slice(-30), { grid: cur.grid, score: cur.score }]);
    setGrid(ng);
    setScore(cur.score + r.gained);
    if (maxTile(ng) >= 2048) setWon(true);
    if (!hasMoves(ng)) setOver(true);
  }, []);

  useEffect(() => {
    const map: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    const onKey = (e: KeyboardEvent) => {
      if (map[e.key]) { e.preventDefault(); doMove(map[e.key]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doMove]);

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      if (latest.current.over) { setAuto(false); return; }
      const dir = bestMove(latest.current.grid);
      if (dir) doMove(dir); else setAuto(false);
    }, 110);
    return () => window.clearInterval(id);
  }, [auto, doMove]);

  const newGame = () => { setGrid(fresh()); setScore(0); setWon(false); setOver(false); setAuto(false); setHistory([]); };
  const undo = () => {
    setHistory(h => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setGrid(last.grid); setScore(last.score); setOver(false); setAuto(false);
      return h.slice(0, -1);
    });
  };

  // Swipe handling.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? 'right' : 'left');
    else doMove(dy > 0 ? 'down' : 'up');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="border-2 border-border px-3 py-1 text-sm"><span className="text-muted-foreground">{t.score}:</span> <span className="font-black tabular-nums">{score}</span></div>
        <Button onClick={newGame}>{t.newGame}</Button>
        <Button variant="secondary" onClick={undo} disabled={!history.length}>{t.undo}</Button>
        <Button variant={auto ? 'ghost' : 'secondary'} onClick={() => setAuto(a => !a)}>{auto ? t.stop : t.auto}</Button>
      </div>

      <div className="relative mx-auto w-full max-w-sm">
        <div className="grid grid-cols-4 gap-2 border-2 border-border bg-muted p-2 touch-none select-none"
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {grid.flat().map((v, i) => (
            <div key={i}
              className={`flex aspect-square items-center justify-center border-2 border-border text-xl font-black tabular-nums sm:text-2xl ${v ? TILE_COLORS[v] ?? 'bg-fuchsia-700 text-white' : 'bg-background'}`}>
              {v || ''}
            </div>
          ))}
        </div>
        {(over || (won && !over)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
            <span className="text-2xl font-black">{over ? t.over : t.won}</span>
            {over ? <Button onClick={newGame}>{t.newGame}</Button> : <Button variant="secondary" onClick={() => setWon(false)}>{t.keepGoing}</Button>}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">{t.hint}</p>
    </div>
  );
}
