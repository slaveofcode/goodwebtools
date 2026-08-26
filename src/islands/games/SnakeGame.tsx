import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Play, Pause, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useExpand } from '@/hooks/useExpand';
import { GRID, initialState, step, queueTurn, tickMs, type SnakeState, type Dir } from '@/tools/games/snake.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'The classic snake — improved: tap the on-screen pad or swipe on phones, use arrow keys on a computer, collect golden bonus food before it fades, and optionally turn off walls to wrap around the edges.',
    score: 'Score', best: 'Best', newGame: 'New game', over: 'Game over', paused: 'Paused',
    wrap: 'Wrap walls', expand: 'Expand', exit: 'Exit', pause: 'Pause', resume: 'Resume',
    start: 'Tap a direction to start',
    hint: 'Tap the pad or swipe · arrow keys / WASD · P to pause · gold food is worth 5 but fades.',
    up: 'Up', down: 'Down', left: 'Left', right: 'Right',
  },
  id: {
    intro: 'Snake klasik — ditingkatkan: ketuk panel di layar atau geser di ponsel, pakai tombol panah di komputer, ambil makanan bonus emas sebelum memudar, dan opsional matikan dinding untuk tembus tepi.',
    score: 'Skor', best: 'Terbaik', newGame: 'Main baru', over: 'Permainan selesai', paused: 'Dijeda',
    wrap: 'Tembus dinding', expand: 'Perbesar', exit: 'Keluar', pause: 'Jeda', resume: 'Lanjut',
    start: 'Ketuk arah untuk mulai',
    hint: 'Ketuk panel atau geser · tombol panah / WASD · P untuk jeda · makanan emas bernilai 5 tapi memudar.',
    up: 'Atas', down: 'Bawah', left: 'Kiri', right: 'Kanan',
  },
};

const BEST_KEY = 'gwt-snake-best';
const CELL = 20; // logical px per cell (canvas is GRID*CELL square)
const SIZE = GRID * CELL;

export default function SnakeGame({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const { ref: stageRef, expanded, enter, exit } = useExpand<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<SnakeState>(initialState());
  const running = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef(false);

  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [wrap, setWrap] = useState(false);

  useEffect(() => { try { setBest(Number(localStorage.getItem(BEST_KEY)) || 0); } catch { /* blocked */ } }, []);
  useEffect(() => { wrapRef.current = wrap; }, [wrap]);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const s = state.current;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Subtle grid.
    ctx.strokeStyle = 'rgba(148,163,184,0.14)';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(SIZE, i * CELL); ctx.stroke();
    }
    // Food.
    const f = s.food;
    ctx.fillStyle = f.kind === 'bonus' ? '#facc15' : '#ef4444';
    const pad = f.kind === 'bonus' ? 2 : 3;
    ctx.beginPath();
    ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL / 2 - pad, 0, Math.PI * 2);
    ctx.fill();
    // Snake: head brighter, body fades toward the tail.
    s.snake.forEach((c, i) => {
      const shade = Math.max(0.35, 1 - i / (s.snake.length + 4));
      ctx.fillStyle = i === 0 ? '#4ade80' : `rgba(34,197,94,${shade})`;
      ctx.fillRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2);
    });
    // Eyes on the head.
    const head = s.snake[0];
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(head.x * CELL + 5, head.y * CELL + 5, 3, 3);
    ctx.fillRect(head.x * CELL + CELL - 8, head.y * CELL + 5, 3, 3);
  }, []);

  const saveBest = (s: number) => setBest((b) => {
    if (s <= b) return b;
    try { localStorage.setItem(BEST_KEY, String(s)); } catch { /* blocked */ }
    return s;
  });

  const loop = useCallback(() => {
    if (!running.current) return;
    state.current = step(state.current, { wrap: wrapRef.current });
    const s = state.current;
    setScore(s.score);
    saveBest(s.score);
    draw();
    if (!s.alive) { running.current = false; setAlive(false); return; }
    timer.current = setTimeout(loop, tickMs(s.score));
  }, [draw]);

  const start = useCallback(() => {
    if (running.current || !state.current.alive) return;
    running.current = true;
    setStarted(true);
    setPaused(false);
    timer.current = setTimeout(loop, tickMs(state.current.score));
  }, [loop]);

  const stopTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const togglePause = () => {
    if (!started || !state.current.alive) return;
    if (running.current) { running.current = false; stopTimer(); setPaused(true); }
    else { start(); }
  };

  const newGame = () => {
    stopTimer();
    running.current = false;
    state.current = initialState();
    setScore(0); setAlive(true); setStarted(false); setPaused(false);
    draw();
  };

  const turn = useCallback((d: Dir) => {
    if (!state.current.alive) return;
    state.current = queueTurn(state.current, d);
    if (!running.current) start();
  }, [start]);

  useEffect(() => { draw(); return () => stopTimer(); }, [draw]);

  useEffect(() => {
    const keys: Record<string, Dir> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    };
    const onKey = (e: KeyboardEvent) => {
      if (keys[e.code]) { e.preventDefault(); turn(keys[e.code]); }
      if (e.code === 'KeyP') { e.preventDefault(); togglePause(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 'right' : 'left');
    else turn(dy > 0 ? 'down' : 'up');
  };

  // A D-pad button. pointerDown fires faster than click and we stop it from
  // stealing focus or scrolling the page under the thumb.
  const DirBtn = ({ dir, icon, label, className }: { dir: Dir; icon: React.ReactNode; label: string; className: string }) => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); turn(dir); }}
      className={`flex h-14 w-14 touch-none select-none items-center justify-center border-2 border-border bg-card active:bg-muted ${className}`}
    >
      {icon}
    </button>
  );

  const dpad = (
    <div className="grid grid-cols-3 grid-rows-3 gap-1" style={{ touchAction: 'none' }}>
      <DirBtn dir="up" icon={<ChevronUp className="h-6 w-6" />} label={t.up} className="col-start-2 row-start-1" />
      <DirBtn dir="left" icon={<ChevronLeft className="h-6 w-6" />} label={t.left} className="col-start-1 row-start-2" />
      <DirBtn dir="right" icon={<ChevronRight className="h-6 w-6" />} label={t.right} className="col-start-3 row-start-2" />
      <DirBtn dir="down" icon={<ChevronDown className="h-6 w-6" />} label={t.down} className="col-start-2 row-start-3" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div
        ref={stageRef}
        className={expanded
          ? 'fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 overflow-hidden bg-background p-3'
          : 'flex flex-col items-center gap-3'}
      >
        {/* Compact single-row scoreboard so the board stays above the fold. */}
        <div className="flex w-full max-w-md items-center justify-center gap-2">
          <div className="flex-1 border-2 border-border px-2 py-1 text-center text-sm"><span className="text-muted-foreground">{t.score}</span> <span className="font-black tabular-nums">{score}</span></div>
          <div className="flex-1 border-2 border-border px-2 py-1 text-center text-sm"><span className="text-muted-foreground">{t.best}</span> <span className="font-black tabular-nums">{best}</span></div>
          <button
            type="button"
            onClick={(e) => { e.currentTarget.blur(); togglePause(); }}
            disabled={!started || !alive}
            aria-label={paused ? t.resume : t.pause}
            className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-border disabled:opacity-40"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.currentTarget.blur(); if (expanded) exit(); else enter(); }}
            aria-label={expanded ? t.exit : t.expand}
            className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-border"
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Board sized to fit the viewport height so the D-pad stays visible. */}
        <div className="relative w-full" style={{ maxWidth: expanded ? 'min(94vw, 60dvh)' : 'min(88vw, 46dvh)' }}>
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="w-full touch-none select-none border-2 border-border"
          />
          {(!alive || paused || !started) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-center text-white">
              {!alive ? (
                <>
                  <span className="text-2xl font-black">{t.over}</span>
                  <span className="text-sm">{t.score}: {score} · {t.best}: {best}</span>
                  <Button onClick={newGame}>{t.newGame}</Button>
                </>
              ) : paused ? (
                <span className="text-2xl font-black">{t.paused}</span>
              ) : (
                <span className="rounded bg-black/50 px-4 py-2 text-sm font-bold">{t.start}</span>
              )}
            </div>
          )}
        </div>

        {/* On-screen D-pad: the primary control on touch devices. */}
        {dpad}

        {/* Secondary controls, below the play area. */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={newGame}>{t.newGame}</Button>
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} className="h-4 w-4 accent-accent" />
            {t.wrap}
          </label>
        </div>

        {!expanded && <p className="max-w-md text-center text-xs text-muted-foreground">{t.hint}</p>}
      </div>

      <p className="text-sm text-muted-foreground">{t.intro}</p>
    </div>
  );
}
