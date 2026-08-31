import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  stepWorld,
  dropFruit,
  newWorld,
  pickDropTier,
  BOX,
  DROP_Y,
  DEADLINE_Y,
  TIER_RADII,
  type World,
} from '@/tools/games/fruitmerge.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Drop fruits and merge matching pairs into bigger ones — cherry all the way to watermelon. Same fruits that touch fuse instantly; keep the box under control or the game ends. Runs entirely in your browser.',
    score: 'Score', best: 'Best', next: 'Next', over: 'Game over', restart: 'Restart',
    hint: 'Move to aim, tap or click to drop. Equal fruits merge on contact.',
    finalScore: 'Final score',
  },
  id: {
    intro: 'Jatuhkan buah dan gabungkan pasangan yang sama menjadi buah lebih besar — dari ceri sampai semangka. Buah sama yang bersentuhan langsung menyatu; jaga kotak tetap lega atau permainan berakhir. Semuanya berjalan di browser Anda.',
    score: 'Skor', best: 'Terbaik', next: 'Berikutnya', over: 'Permainan selesai', restart: 'Mulai ulang',
    hint: 'Geser untuk membidik, ketuk atau klik untuk menjatuhkan. Buah yang sama menyatu saat bersentuhan.',
    finalScore: 'Skor akhir',
  },
};

const BEST_KEY = 'gwt-fruitmerge-best-v1';
const DROP_COOLDOWN_MS = 500;
const DT = 1 / 60;
const SUBSTEPS = 2;

/** Flat fill + darker rim per tier — cherry red to watermelon green. */
const TIER_COLORS: ReadonlyArray<[string, string]> = [
  ['#f87171', '#b91c1c'], // cherry
  ['#fb923c', '#c2410c'], // strawberry-ish
  ['#facc15', '#a16207'], // persimmon
  ['#a3e635', '#4d7c0f'], // apple green
  ['#34d399', '#047857'], // pear
  ['#2dd4bf', '#0f766e'], // kiwi
  ['#60a5fa', '#1d4ed8'], // blueberry
  ['#c084fc', '#6d28d9'], // plum
  ['#f472b6', '#be185d'], // peach-pink
  ['#fdba74', '#c2410c'], // pineapple
  ['#4ade80', '#15803d'], // watermelon
];

function clampX(x: number, tier: number): number {
  const r = TIER_RADII[tier];
  return Math.min(Math.max(x, BOX.wall + r), BOX.w - BOX.wall - r);
}

export default function FruitMerge({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World>(newWorld());
  const heldRef = useRef<{ tier: number; x: number; nextTier: number; readyAt: number }>({
    tier: 0, x: BOX.w / 2, nextTier: 0, readyAt: 0,
  });
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(0);
  const [nextTier, setNextTier] = useState(0);

  useEffect(() => {
    try { setBest(Number(localStorage.getItem(BEST_KEY)) || 0); } catch { /* blocked */ }
  }, []);

  const restart = useCallback(() => {
    worldRef.current = newWorld();
    heldRef.current = { tier: pickDropTier(Math.random), x: BOX.w / 2, nextTier: pickDropTier(Math.random), readyAt: performance.now() + DROP_COOLDOWN_MS };
    setNextTier(heldRef.current.nextTier);
    setScore(0);
    setOver(false);
  }, []);

  // Init held fruit on mount.
  useEffect(() => {
    restart();
  }, [restart]);

  // Game loop: fixed-step accumulator, canvas render each frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = BOX.w * dpr;
    canvas.height = BOX.h * dpr;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let running = true;

    const draw = () => {
      const w = worldRef.current;
      ctx.save();
      ctx.scale(dpr, dpr);

      // background
      ctx.fillStyle = '#f5f5f4';
      ctx.fillRect(0, 0, BOX.w, BOX.h);

      // walls
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(0, 0, BOX.wall, BOX.h);
      ctx.fillRect(BOX.w - BOX.wall, 0, BOX.wall, BOX.h);
      ctx.fillRect(0, BOX.h - BOX.wall, BOX.w, BOX.wall);

      // deadline
      ctx.strokeStyle = '#f87171';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(BOX.wall, DEADLINE_Y);
      ctx.lineTo(BOX.w - BOX.wall, DEADLINE_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      // fruits
      for (const f of w.fruits) {
        const [fill, rim] = TIER_COLORS[f.tier] ?? TIER_COLORS[0]!;
        ctx.beginPath();
        ctx.arc(f.x, f.y, TIER_RADII[f.tier], 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = rim;
        ctx.stroke();
      }

      // held fruit + guide
      const held = heldRef.current;
      if (!w.over && held.readyAt <= performance.now()) {
        const r = TIER_RADII[held.tier];
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(held.x, DROP_Y + r);
        ctx.lineTo(held.x, BOX.h - BOX.wall);
        ctx.stroke();
        ctx.setLineDash([]);
        const [fill, rim] = TIER_COLORS[held.tier] ?? TIER_COLORS[0]!;
        ctx.beginPath();
        ctx.arc(held.x, DROP_Y, r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = rim;
        ctx.stroke();
      }

      ctx.restore();
    };

    const frame = (now: number) => {
      if (!running) return;
      acc += Math.min(now - last, 100) / 1000;
      last = now;
      while (acc >= DT) {
        const prev = worldRef.current;
        for (let i = 0; i < SUBSTEPS; i++) {
          worldRef.current = stepWorld(worldRef.current, DT / SUBSTEPS);
        }
        const next = worldRef.current;
        if (next.over && !prev.over) {
          setOver(true);
          setBest(b => {
            const nb = Math.max(b, next.score);
            try { localStorage.setItem(BEST_KEY, String(nb)); } catch { /* blocked */ }
            return nb;
          });
        }
        if (next.score !== prev.score) setScore(next.score);
        acc -= DT;
      }
      draw();
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  const drop = useCallback(() => {
    const w = worldRef.current;
    if (w.over) return;
    const held = heldRef.current;
    if (held.readyAt > performance.now()) return;
    worldRef.current = dropFruit(w, held.x, held.tier);
    heldRef.current = {
      tier: held.nextTier,
      x: held.x,
      nextTier: pickDropTier(Math.random),
      readyAt: performance.now() + DROP_COOLDOWN_MS,
    };
    setNextTier(heldRef.current.nextTier);
  }, []);

  const aim = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * BOX.w;
    heldRef.current.x = clampX(x, heldRef.current.tier);
  }, []);

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (over) return;
    aim(e.clientX);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (over) return;
    aim(e.clientX);
    drop();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-2xl">{t.intro}</p>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.score}</span> <span className="text-xl font-extrabold" data-testid="fm-score">{score}</span></div>
        <div><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.best}</span> <span className="text-xl font-extrabold">{best}</span></div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.next}</span>
          <span
            aria-hidden
            className="inline-block rounded-full border-2 border-border"
            style={{
              width: 18, height: 18,
              backgroundColor: TIER_COLORS[nextTier]?.[0] ?? '#ccc',
              borderColor: TIER_COLORS[nextTier]?.[1] ?? '#888',
            }}
            data-testid="fm-next"
          />
        </div>
        {over && <Button onClick={restart}><RotateCcw className="w-4 h-4" />{t.restart}</Button>}
      </div>

      <div className="relative mx-auto w-full max-w-[360px]">
        <canvas
          ref={canvasRef}
          style={{ aspectRatio: `${BOX.w} / ${BOX.h}`, touchAction: 'none' }}
          className="w-full border-2 border-border bg-stone-100 shadow-brutal"
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          data-testid="fm-canvas"
        />
        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 border-2 border-border bg-background/85 p-6 text-center" data-testid="fm-over">
            <p className="text-lg font-extrabold uppercase">{t.over}</p>
            <p className="text-sm">{t.finalScore}: <span className="font-extrabold">{score}</span></p>
            <Button onClick={restart}><RotateCcw className="w-4 h-4" />{t.restart}</Button>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t.hint}</p>
    </div>
  );
}
