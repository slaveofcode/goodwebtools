import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useExpand } from '@/hooks/useExpand';
import {
  newRunner, stepRunner, jump, speedAt, spawnGap, makeObstacle, hits, runnerHeight,
  GROUND_Y, RUNNER_X, RUNNER_W, type Runner, type Obstacle,
} from '@/tools/games/runner.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'An endless runner in the spirit of the offline dino game — but with double jump, fast-fall, ducking, flying obstacles, day/night cycles and a saved best score.',
    ready: 'Tap / Space to start', dead: 'Game over', best: 'Best', restart: 'Tap to restart',
    score: 'Score', expand: 'Expand', exit: 'Exit',
    hint: 'Space / tap to jump (twice for a double jump) · ↓ or swipe down to duck & fast-fall.',
  },
  id: {
    intro: 'Game lari tanpa akhir bergaya game dino offline — tapi dengan lompat ganda, jatuh cepat, menunduk, rintangan terbang, siklus siang/malam, dan skor terbaik tersimpan.',
    ready: 'Ketuk / Spasi untuk mulai', dead: 'Permainan selesai', best: 'Terbaik', restart: 'Ketuk untuk ulang',
    score: 'Skor', expand: 'Perbesar', exit: 'Keluar',
    hint: 'Spasi / ketuk untuk lompat (dua kali untuk lompat ganda) · ↓ atau geser ke bawah untuk menunduk & jatuh cepat.',
  },
};

const BASE_W = 640, H = 260;
const BEST_KEY = 'gwt-dino-best';
/** Score interval at which day flips to night. */
const NIGHT_EVERY = 25;

interface Game {
  phase: 'ready' | 'playing' | 'dead';
  runner: Runner;
  obstacles: Obstacle[];
  spawnIn: number;
  score: number;
  dist: number;
  down: boolean;
}

const initial = (): Game => ({ phase: 'ready', runner: newRunner(), obstacles: [], spawnIn: 1.2, score: 0, dist: 0, down: false });

export default function DinoRun({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const { ref: stageRef, expanded, enter, exit } = useExpand<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const g = useRef<Game>(initial());
  const dims = useRef({ W: BASE_W });
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'dead'>('ready');
  const [score, setScore] = useState(0);

  useEffect(() => { try { setBest(Number(localStorage.getItem(BEST_KEY)) || 0); } catch { /* blocked */ } }, []);

  const saveBest = (s: number) => setBest((b) => {
    if (s <= b) return b;
    try { localStorage.setItem(BEST_KEY, String(s)); } catch { /* blocked */ }
    return s;
  });

  const press = () => {
    const s = g.current;
    if (s.phase === 'ready') { s.phase = 'playing'; setPhase('playing'); s.runner = jump(s.runner); return; }
    if (s.phase === 'dead') { g.current = initial(); setPhase('ready'); setScore(0); return; }
    s.runner = jump(s.runner);
  };
  const setDown = (v: boolean) => { g.current.down = v; };

  // Expanded → widen the logical playfield to the screen's aspect ratio.
  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    const apply = () => {
      const rect = frame.getBoundingClientRect();
      const W = expanded && rect.height > 0 ? Math.max(360, Math.round((H * rect.width) / rect.height)) : BASE_W;
      if (W !== dims.current.W) { dims.current.W = W; canvas.width = W; }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [expanded]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    let last = performance.now();

    const draw = (s: Game) => {
      const W = dims.current.W;
      const night = Math.floor(s.score / NIGHT_EVERY) % 2 === 1;
      const sky = night ? '#0f172a' : '#e0f2fe';
      const ink = night ? '#e2e8f0' : '#0f172a';
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Parallax hills / stars.
      ctx.fillStyle = night ? '#1e293b' : '#bae6fd';
      for (let i = 0; i < 6; i++) {
        const x = ((i * 220 - s.dist * 0.25) % (W + 220)) - 110;
        if (night) { ctx.fillRect(x + 40, 40, 3, 3); ctx.fillRect(x + 120, 70, 2, 2); }
        else { ctx.beginPath(); ctx.arc(x, GROUND_Y, 70, Math.PI, 0); ctx.fill(); }
      }

      // Ground line + moving dashes.
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke();
      ctx.fillStyle = ink;
      for (let i = 0; i < 20; i++) {
        const x = ((i * 90 - s.dist) % (W + 90)) - 45;
        ctx.fillRect(x, GROUND_Y + 8, 22, 2);
      }

      // Obstacles.
      for (const o of s.obstacles) {
        const bottom = GROUND_Y - o.y;
        ctx.fillStyle = o.kind === 'bird' ? (night ? '#f472b6' : '#be123c') : o.kind === 'rock' ? '#78716c' : '#15803d';
        if (o.kind === 'bird') {
          // Simple flapping wing silhouette.
          const flap = Math.sin(s.dist / 22) * 6;
          ctx.beginPath();
          ctx.moveTo(o.x, bottom - o.h / 2);
          ctx.lineTo(o.x + o.w / 2, bottom - o.h / 2 - flap);
          ctx.lineTo(o.x + o.w, bottom - o.h / 2);
          ctx.lineTo(o.x + o.w / 2, bottom - o.h / 2 + 8);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(o.x, bottom - o.h, o.w, o.h);
          if (o.kind === 'cactus' && o.w > 30) {
            ctx.fillRect(o.x - 6, bottom - o.h * 0.6, 6, o.h * 0.35);
            ctx.fillRect(o.x + o.w, bottom - o.h * 0.7, 6, o.h * 0.4);
          }
        }
      }

      // Runner.
      const rh = runnerHeight(s.runner);
      const top = GROUND_Y + s.runner.y - rh;
      ctx.fillStyle = night ? '#fbbf24' : '#1f2937';
      ctx.fillRect(RUNNER_X, top, RUNNER_W, rh);
      // Eye + legs for a bit of character.
      ctx.fillStyle = sky;
      ctx.fillRect(RUNNER_X + RUNNER_W - 12, top + 6, 4, 4);
      if (s.runner.y === 0 && s.phase === 'playing') {
        const legPhase = Math.floor(s.dist / 12) % 2 === 0;
        ctx.fillStyle = night ? '#fbbf24' : '#1f2937';
        ctx.fillRect(RUNNER_X + (legPhase ? 2 : 18), GROUND_Y, 10, 6);
      }

      // Score.
      ctx.fillStyle = ink;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(String(s.score).padStart(5, '0'), W - 16, 30);
      ctx.textAlign = 'left';
    };

    const frame = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const s = g.current;
      const W = dims.current.W;

      if (s.phase === 'playing') {
        const speed = speedAt(s.score);
        s.dist += speed * dt;
        s.runner = stepRunner(s.runner, dt, s.down);

        s.spawnIn -= dt;
        if (s.spawnIn <= 0) {
          s.obstacles.push(makeObstacle(W + 20, s.score, Math.random()));
          s.spawnIn = spawnGap(speed, Math.random());
        }
        for (const o of s.obstacles) o.x -= speed * dt;
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > -20);

        for (const o of s.obstacles) {
          if (!o.scored && o.x + o.w < RUNNER_X) {
            o.scored = true;
            s.score += 1;
            setScore(s.score);
            saveBest(s.score);
          }
        }
        if (s.obstacles.some((o) => hits(s.runner, o))) { s.phase = 'dead'; setPhase('dead'); }
      }
      draw(s);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); press(); }
      if (e.code === 'ArrowDown') { e.preventDefault(); setDown(true); }
    };
    const onUp = (e: KeyboardEvent) => { if (e.code === 'ArrowDown') setDown(false); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // Touch: tap to jump, swipe/hold down to duck.
  const touchY = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    touchY.current = e.clientY;
    press();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (touchY.current === null) return;
    if (e.clientY - touchY.current > 26) setDown(true);
  };
  const onPointerUp = () => { touchY.current = null; setDown(false); };

  const expandBtn = (
    <Button variant="secondary" onClick={(e) => { e.currentTarget.blur(); if (expanded) exit(); else enter(); }}>
      {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      {expanded ? t.exit : t.expand}
    </Button>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div ref={stageRef} className={expanded ? 'fixed inset-0 z-[60] overflow-hidden bg-black' : 'space-y-3'}>
        {!expanded && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="border-2 border-border px-3 py-1 text-sm"><span className="text-muted-foreground">{t.score}:</span> <span className="font-black tabular-nums">{score}</span></div>
            <div className="border-2 border-border px-3 py-1 text-sm"><span className="text-muted-foreground">{t.best}:</span> <span className="font-black tabular-nums">{best}</span></div>
            {expandBtn}
          </div>
        )}

        <div ref={frameRef} className={expanded ? 'absolute inset-0' : 'relative mx-auto w-full max-w-[640px]'}>
          <canvas
            ref={canvasRef}
            width={BASE_W}
            height={H}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`cursor-pointer touch-none select-none ${expanded ? 'h-full w-full' : 'w-full border-2 border-border'}`}
          />
          {phase !== 'playing' && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-white">
              <div className="rounded bg-black/60 px-4 py-2">
                <div className="text-lg font-black">{phase === 'dead' ? t.dead : t.ready}</div>
                {phase === 'dead' && <div className="text-sm">{t.score}: {score} · {t.best}: {best} · {t.restart}</div>}
              </div>
            </div>
          )}
        </div>

        {expanded && (
          <div className="absolute left-0 right-0 top-0 flex items-center justify-between gap-3 p-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
            <div className="pointer-events-none border-2 border-border bg-background/90 px-3 py-1 text-sm"><span className="text-muted-foreground">{t.best}:</span> <span className="font-black tabular-nums">{best}</span></div>
            {expandBtn}
          </div>
        )}
      </div>

      {!expanded && <p className="text-center text-xs text-muted-foreground">{t.hint}</p>}
    </div>
  );
}
