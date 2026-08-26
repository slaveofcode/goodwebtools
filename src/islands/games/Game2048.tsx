import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useExpand } from '@/hooks/useExpand';
import { moveTiles, tilesToGrid, emptyCells, hasMoves, maxTile, bestMove, type Tile, type Ghost, type Direction } from '@/tools/games/game2048.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Play 2048 — combine tiles to reach 2048. Use arrow keys or swipe. Includes cheats: Undo and an Auto-play that simulates the best moves for you.',
    score: 'Score', newGame: 'New game', undo: 'Undo', auto: 'Auto-play (cheat)', stop: 'Stop', won: 'You made 2048! 🎉', over: 'Game over', keepGoing: 'Keep going',
    hint: 'Arrow keys or swipe to move.', expand: 'Expand', exit: 'Exit',
  },
  id: {
    intro: 'Main 2048 — gabungkan ubin untuk mencapai 2048. Pakai tombol panah atau geser. Termasuk cheat: Urungkan dan Auto-play yang mensimulasikan langkah terbaik untuk Anda.',
    score: 'Skor', newGame: 'Main baru', undo: 'Urungkan', auto: 'Auto-play (cheat)', stop: 'Berhenti', won: 'Anda mencapai 2048! 🎉', over: 'Permainan selesai', keepGoing: 'Lanjutkan',
    hint: 'Tombol panah atau geser untuk bergerak.', expand: 'Perbesar', exit: 'Keluar',
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

// Slide 130ms ease-in-out (transform-only); pop/spawn keyframes fire after the
// slide lands. All motion is disabled under prefers-reduced-motion.
const KEYFRAMES = `
@keyframes gwt2048-pop { 0% { scale: 1; } 55% { scale: 1.18; } 100% { scale: 1; } }
@keyframes gwt2048-spawn { 0% { scale: 0.4; opacity: 0; } 100% { scale: 1; opacity: 1; } }
.gwt2048-pop { animation: gwt2048-pop 170ms ease-out 120ms both; }
.gwt2048-spawn { animation: gwt2048-spawn 160ms ease-out 110ms both; }
@media (prefers-reduced-motion: reduce) {
  .gwt2048-pop, .gwt2048-spawn { animation: none; }
}
`;

let idCounter = 1;
const uid = () => idCounter++;

function spawn(tiles: Tile[]): Tile[] {
  const cells = emptyCells(tilesToGrid(tiles));
  if (!cells.length) return tiles;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  return [...tiles, { id: uid(), value: Math.random() < 0.9 ? 2 : 4, r, c, isNew: true }];
}

function fresh(): Tile[] { return spawn(spawn([])); }

export default function Game2048({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const { ref: stageRef, expanded, enter, exit } = useExpand<HTMLDivElement>();
  // Start empty so the server and first client render match; the opening tiles
  // (which use Math.random) are dealt in a mount effect to avoid a hydration
  // mismatch (React #425).
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [score, setScore] = useState(0);
  const [won, setWon] = useState(false);
  const [over, setOver] = useState(false);
  const [auto, setAuto] = useState(false);
  const [history, setHistory] = useState<{ tiles: Tile[]; score: number }[]>([]);
  const ghostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const latest = useRef({ tiles, score, over });
  latest.current = { tiles, score, over };

  useEffect(() => { setTiles(fresh()); }, []);
  useEffect(() => () => { if (ghostTimer.current) clearTimeout(ghostTimer.current); }, []);

  const doMove = useCallback((dir: Direction | null) => {
    const cur = latest.current;
    if (cur.over || !dir) return;
    const r = moveTiles(cur.tiles, dir);
    if (!r.moved) return;
    const next = spawn(r.tiles);
    setHistory(h => [...h.slice(-30), { tiles: cur.tiles, score: cur.score }]);
    setTiles(next);
    setScore(cur.score + r.gained);
    // Ghosts: swallowed tiles slide to the merge cell, then vanish.
    setGhosts(r.ghosts);
    if (ghostTimer.current) clearTimeout(ghostTimer.current);
    ghostTimer.current = setTimeout(() => setGhosts([]), 170);
    const grid = tilesToGrid(next);
    if (maxTile(grid) >= 2048) setWon(true);
    if (!hasMoves(grid)) setOver(true);
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
      const dir = bestMove(tilesToGrid(latest.current.tiles));
      if (dir) doMove(dir); else setAuto(false);
    }, 160);
    return () => window.clearInterval(id);
  }, [auto, doMove]);

  const newGame = () => { setTiles(fresh()); setGhosts([]); setScore(0); setWon(false); setOver(false); setAuto(false); setHistory([]); };
  const undo = () => {
    setHistory(h => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setTiles(last.tiles); setGhosts([]); setScore(last.score); setOver(false); setAuto(false);
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

  const fontFor = (v: number) => (v >= 1024 ? 'text-base sm:text-xl' : v >= 128 ? 'text-lg sm:text-2xl' : 'text-xl sm:text-2xl');

  // A tile occupies exactly 1/4 of the board; translate() is relative to the
  // element's own size, so (c*100%, r*100%) lands it on its cell. Animating
  // transform only (no top/left) keeps slides on the compositor.
  const tileStyle = (r: number, c: number): React.CSSProperties => ({
    transform: `translate(${c * 100}%, ${r * 100}%)`,
  });

  return (
    <div className="space-y-4">
      <style>{KEYFRAMES}</style>
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {/* Stage: normal flow, or a fullscreen overlay (native fullscreen on
          Android, CSS overlay fallback on iOS) for comfortable mobile play. */}
      <div
        ref={stageRef}
        className={expanded
          ? 'fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 overflow-hidden bg-background p-4'
          : 'space-y-4'}
      >
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="border-2 border-border px-3 py-1 text-sm"><span className="text-muted-foreground">{t.score}:</span> <span className="font-black tabular-nums">{score}</span></div>
        <Button onClick={newGame}>{t.newGame}</Button>
        <Button variant="secondary" onClick={undo} disabled={!history.length}>{t.undo}</Button>
        <Button variant={auto ? 'ghost' : 'secondary'} onClick={() => setAuto(a => !a)}>{auto ? t.stop : t.auto}</Button>
        <Button
          variant="secondary"
          onClick={e => { e.currentTarget.blur(); if (expanded) exit(); else enter(); }}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {expanded ? t.exit : t.expand}
        </Button>
      </div>

      <div className={expanded ? 'relative w-full max-w-[min(92vw,62dvh)]' : 'relative mx-auto w-full max-w-sm'}>
        <div
          className="relative aspect-square w-full touch-none select-none border-2 border-border bg-muted p-1"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Background cells */}
          <div className="grid h-full w-full grid-cols-4 grid-rows-4">
            {Array.from({ length: 16 }, (_, i) => (
              <div key={i} className="m-1 border-2 border-border bg-background" />
            ))}
          </div>

          {/* Ghosts: swallowed tiles finishing their slide under the survivors. */}
          <div className="pointer-events-none absolute inset-1">
            {ghosts.map(g => (
              <div key={`g${g.id}`} className="absolute left-0 top-0 h-1/4 w-1/4 transition-transform duration-[130ms] ease-in-out will-change-transform motion-reduce:transition-none" style={tileStyle(g.r, g.c)}>
                <div className={`m-1 flex h-[calc(100%-0.5rem)] items-center justify-center border-2 border-border font-black tabular-nums ${fontFor(g.value)} ${TILE_COLORS[g.value] ?? 'bg-fuchsia-700 text-white'}`}>
                  {g.value}
                </div>
              </div>
            ))}
          </div>

          {/* Live tiles: transform slides + pop/spawn keyframes. */}
          <div className="pointer-events-none absolute inset-1">
            {tiles.map(tile => (
              <div key={tile.id} className="absolute left-0 top-0 h-1/4 w-1/4 transition-transform duration-[130ms] ease-in-out will-change-transform motion-reduce:transition-none" style={tileStyle(tile.r, tile.c)}>
                <div className={`m-1 flex h-[calc(100%-0.5rem)] items-center justify-center border-2 border-border font-black tabular-nums ${fontFor(tile.value)} ${TILE_COLORS[tile.value] ?? 'bg-fuchsia-700 text-white'} ${tile.justMerged ? 'gwt2048-pop' : ''} ${tile.isNew ? 'gwt2048-spawn' : ''}`}>
                  {tile.value}
                </div>
              </div>
            ))}
          </div>

          {(over || (won && !over)) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
              <span className="text-2xl font-black">{over ? t.over : t.won}</span>
              {over ? <Button onClick={newGame}>{t.newGame}</Button> : <Button variant="secondary" onClick={() => setWon(false)}>{t.keepGoing}</Button>}
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">{t.hint}</p>
      </div>
    </div>
  );
}
