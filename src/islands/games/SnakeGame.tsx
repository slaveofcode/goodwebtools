import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useExpand } from '@/hooks/useExpand';
import { GRID, initialState, step, queueTurn, tickMs, type SnakeState, type Dir } from '@/tools/games/snake.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'The classic snake — improved: swipe or use arrow keys, queue two turns so fast moves never get dropped, collect golden bonus food before it fades, and optionally turn off walls to wrap around the edges.',
    score: 'Score', best: 'Best', newGame: 'New game', over: 'Game over', paused: 'Paused',
    wrap: 'Wrap walls', expand: 'Expand', exit: 'Exit', pause: 'Pause', resume: 'Resume',
    start: 'Swipe or press an arrow key to start',
    hint: 'Arrow keys / WASD or swipe · P to pause · gold food is worth 5 but fades.',
  },
  id: {
    intro: 'Snake klasik — ditingkatkan: geser atau pakai tombol panah, antrean dua belokan agar gerakan cepat tidak hilang, ambil makanan bonus emas sebelum memudar, dan opsional matikan dinding untuk tembus tepi.',
    score: 'Skor', best: 'Terbaik', newGame: 'Main baru', over: 'Permainan selesai', paused: 'Dijeda',
    wrap: 'Tembus dinding', expand: 'Perbesar', exit: 'Keluar', pause: 'Jeda', resume: 'Lanjut',
    start: 'Geser atau tekan tombol panah untuk mulai',
    hint: 'Tombol panah / WASD atau geser · P untuk jeda · makanan emas bernilai 5 tapi memudar.',
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
    state.current = queueTurn(state.current, d);
    if (!running.current && state.current.alive) start();
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

  return (
    <div className="space-y-4">
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
          <Button variant="secondary" onClick={(e) => { e.currentTarget.blur(); togglePause(); }} disabled={!started || !alive}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? t.resume : t.pause}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} className="h-4 w-4 accent-accent" />
            {t.wrap}
          </label>
          <Button variant="secondary" onClick={(e) => { e.currentTarget.blur(); if (expanded) exit(); else enter(); }}>
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {expanded ? t.exit : t.expand}
          </Button>
        </div>

        <div className={expanded ? 'relative w-full max-w-[min(92vw,64dvh)]' : 'relative mx-auto w-full max-w-md'}>
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

        <p className="text-center text-xs text-muted-foreground">{t.hint}</p>
      </div>
    </div>
  );
}
