import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useExpand } from '@/hooks/useExpand';
import { BOARD, emptyBoard, canPlace, isGameOver, placeAndClear, drawHand, pieceSize, type Board, type PieceShape } from '@/tools/games/blocks.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Drag the three pieces onto the 8×8 board. Fill a full row or column to clear it. No timer, no gravity — just keep placing. How long can you last?',
    score: 'Score', best: 'Best', newGame: 'New game', over: 'No more moves!', expand: 'Expand', exit: 'Exit',
    hint: 'Drag a piece onto the board — full rows and columns clear.',
  },
  id: {
    intro: 'Seret tiga potongan ke papan 8×8. Isi satu baris atau kolom penuh untuk menghapusnya. Tanpa timer, tanpa gravitasi — terus pasang saja. Berapa lama Anda bertahan?',
    score: 'Skor', best: 'Terbaik', newGame: 'Main baru', over: 'Tidak ada langkah lagi!', expand: 'Perbesar', exit: 'Keluar',
    hint: 'Seret potongan ke papan — baris dan kolom penuh akan terhapus.',
  },
};

const COLORS: Record<number, string> = {
  1: 'bg-amber-400', 2: 'bg-sky-400', 3: 'bg-emerald-400', 4: 'bg-orange-400',
  5: 'bg-red-400', 6: 'bg-fuchsia-400', 7: 'bg-lime-400', 8: 'bg-cyan-400', 9: 'bg-violet-400',
};

const KEYFRAMES = `
@keyframes gwtblocks-clear { 0% { opacity: 1; scale: 1; } 100% { opacity: 0; scale: 0.4; } }
.gwtblocks-clear { animation: gwtblocks-clear 220ms ease-in both; }
@keyframes gwtblocks-place { 0% { scale: 0.7; } 100% { scale: 1; } }
.gwtblocks-place { animation: gwtblocks-place 120ms ease-out both; }
@media (prefers-reduced-motion: reduce) { .gwtblocks-clear, .gwtblocks-place { animation: none; } }
`;

const BEST_KEY = 'gwt-blocks-best';
/** How far the dragged piece floats above the finger (px) so it stays visible. */
const LIFT = 28;

interface Drag { idx: number; x: number; y: number }

export default function BlockPuzzle({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const { ref: stageRef, expanded, enter, exit } = useExpand<HTMLDivElement>();
  const [board, setBoard] = useState<Board>(emptyBoard);
  // Three empty slots on the server and first client render (deterministic);
  // the random opening hand is dealt in a mount effect so hydration matches
  // (avoids React #425).
  const [hand, setHand] = useState<(PieceShape | null)[]>([null, null, null]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [flash, setFlash] = useState<[number, number][]>([]);
  const [placedAt, setPlacedAt] = useState<[number, number][]>([]);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ board, hand, score });
  latest.current = { board, hand, score };

  useEffect(() => {
    setHand(drawHand());
    try { setBest(Number(localStorage.getItem(BEST_KEY)) || 0); } catch { /* blocked */ }
    return () => { if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, []);

  const saveBest = (s: number) => {
    setBest((b) => {
      const nb = Math.max(b, s);
      try { localStorage.setItem(BEST_KEY, String(nb)); } catch { /* blocked */ }
      return nb;
    });
  };

  /** Board cell the dragged piece's top-left currently targets, or null. */
  const targetOf = useCallback((d: Drag): { r: number; c: number; ok: boolean } | null => {
    const piece = latest.current.hand[d.idx];
    const rect = boardRef.current?.getBoundingClientRect();
    if (!piece || !rect) return null;
    const cell = rect.width / BOARD;
    const [rows, cols] = pieceSize(piece);
    const left = d.x - (cols * cell) / 2;
    const top = d.y - rows * cell - LIFT;
    const c = Math.round((left - rect.left) / cell);
    const r = Math.round((top - rect.top) / cell);
    if (r < -1 || c < -1 || r > BOARD || c > BOARD) return null;
    return { r, c, ok: canPlace(latest.current.board, piece, r, c) };
  }, []);

  const drop = useCallback((d: Drag) => {
    const piece = latest.current.hand[d.idx];
    const target = targetOf(d);
    if (!piece || !target || !target.ok) return;
    const res = placeAndClear(latest.current.board, piece, target.r, target.c);
    const newScore = latest.current.score + res.points;
    let newHand = latest.current.hand.map((p, i) => (i === d.idx ? null : p));
    if (newHand.every((p) => p === null)) newHand = drawHand();
    setBoard(res.board);
    setHand(newHand);
    setScore(newScore);
    saveBest(newScore);
    setPlacedAt(piece.cells.map(([dr, dc]) => [target.r + dr, target.c + dc] as [number, number]));
    if (res.cleared.length) {
      setFlash(res.cleared);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash([]), 240);
    }
    if (isGameOver(res.board, newHand.filter((p): p is PieceShape => !!p))) setOver(true);
  }, [targetOf]);

  // Window-level pointer tracking while dragging.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => { e.preventDefault(); setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d)); };
    const onUp = (e: PointerEvent) => {
      setDrag((d) => {
        if (d) drop({ ...d, x: e.clientX, y: e.clientY });
        return null;
      });
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drag, drop]);

  const newGame = () => { setBoard(emptyBoard()); setHand(drawHand()); setScore(0); setOver(false); setFlash([]); setPlacedAt([]); };

  const target = drag ? targetOf(drag) : null;
  const previewCells = new Set<string>();
  if (drag && target && target.ok) {
    const piece = hand[drag.idx];
    if (piece) for (const [dr, dc] of piece.cells) previewCells.add(`${target.r + dr},${target.c + dc}`);
  }
  const flashSet = new Set(flash.map(([r, c]) => `${r},${c}`));
  const placedSet = new Set(placedAt.map(([r, c]) => `${r},${c}`));

  const cellPx = boardRef.current ? boardRef.current.getBoundingClientRect().width / BOARD : 40;

  const tray = (
    <div className="flex min-h-[72px] items-center justify-center gap-4">
      {hand.map((piece, i) => {
        if (!piece || (drag && drag.idx === i)) return <div key={i} className="h-16 w-16" />;
        const [rows, cols] = pieceSize(piece);
        const mini = 14;
        return (
          <button
            key={i}
            type="button"
            aria-label={`piece ${piece.id}`}
            className="flex h-16 w-16 cursor-grab touch-none items-center justify-center"
            onPointerDown={(e) => { e.preventDefault(); setDrag({ idx: i, x: e.clientX, y: e.clientY }); }}
          >
            <div className="relative" style={{ width: cols * mini, height: rows * mini }}>
              {piece.cells.map(([r, c], j) => (
                <div key={j} className={`absolute border border-border ${COLORS[piece.color]}`}
                  style={{ left: c * mini, top: r * mini, width: mini - 1, height: mini - 1 }} />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <style>{KEYFRAMES}</style>
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div
        ref={stageRef}
        className={expanded
          ? 'fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 overflow-hidden bg-background p-4'
          : 'space-y-3'}
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="border-2 border-border px-3 py-1 text-sm"><span className="text-muted-foreground">{t.score}:</span> <span className="font-black tabular-nums">{score}</span></div>
          <div className="border-2 border-border px-3 py-1 text-sm"><span className="text-muted-foreground">{t.best}:</span> <span className="font-black tabular-nums">{best}</span></div>
          <Button onClick={newGame}>{t.newGame}</Button>
          <Button variant="secondary" onClick={(e) => { e.currentTarget.blur(); if (expanded) exit(); else enter(); }}>
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {expanded ? t.exit : t.expand}
          </Button>
        </div>

        <div className={expanded ? 'relative w-full max-w-[min(92vw,52dvh)]' : 'relative mx-auto w-full max-w-sm'}>
          <div ref={boardRef} className="relative aspect-square w-full touch-none select-none border-2 border-border bg-muted p-0.5">
            <div className="grid h-full w-full grid-cols-8 grid-rows-8">
              {Array.from({ length: BOARD * BOARD }, (_, i) => {
                const r = Math.floor(i / BOARD);
                const c = i % BOARD;
                const key = `${r},${c}`;
                const v = board[r][c];
                const preview = previewCells.has(key);
                return (
                  <div key={i} className="p-[1.5px]">
                    <div className={`h-full w-full border border-border ${
                      flashSet.has(key) ? `gwtblocks-clear ${COLORS[1]}`
                      : v ? `${COLORS[v]} ${placedSet.has(key) ? 'gwtblocks-place' : ''}`
                      : preview ? 'bg-accent/40'
                      : 'bg-background'}`} />
                  </div>
                );
              })}
            </div>

            {over && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
                <span className="text-2xl font-black">{t.over}</span>
                <span className="text-sm">{t.score}: {score} · {t.best}: {best}</span>
                <Button onClick={newGame}>{t.newGame}</Button>
              </div>
            )}
          </div>

          {tray}
        </div>

        <p className="text-center text-xs text-muted-foreground">{t.hint}</p>
      </div>

      {/* Dragged piece follows the pointer, floating above the finger. */}
      {drag && hand[drag.idx] && (
        <div className="pointer-events-none fixed z-[70]" style={{
          left: drag.x - (pieceSize(hand[drag.idx]!)[1] * cellPx) / 2,
          top: drag.y - pieceSize(hand[drag.idx]!)[0] * cellPx - LIFT,
        }}>
          {hand[drag.idx]!.cells.map(([r, c], j) => (
            <div key={j} className={`absolute border-2 border-border ${COLORS[hand[drag.idx]!.color]} ${target?.ok ? '' : 'opacity-60'}`}
              style={{ left: c * cellPx, top: r * cellPx, width: cellPx - 2, height: cellPx - 2 }} />
          ))}
        </div>
      )}
    </div>
  );
}
