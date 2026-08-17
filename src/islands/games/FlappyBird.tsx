import { useEffect, useRef, useState } from 'react';
import { stepBird, outOfBounds, hitsPipe, type Pipe } from '@/tools/games/flappy.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'A flappy-bird style game. Click, tap or press Space to flap and fly through the gaps. How far can you get?',
    ready: 'Tap / Space to start', dead: 'Game over', best: 'Best', restart: 'Tap to restart',
  },
  id: {
    intro: 'Game bergaya flappy bird. Klik, ketuk, atau tekan Spasi untuk mengepak dan terbang melewati celah. Sejauh apa Anda bisa?',
    ready: 'Ketuk / Spasi untuk mulai', dead: 'Permainan selesai', best: 'Terbaik', restart: 'Ketuk untuk ulang',
  },
};

const W = 360, H = 540;
const GROUND = H - 40;
const BIRD_X = 92, R = 14;
const GRAVITY = 1500, FLAP = -440, SPEED = 150, PIPE_W = 58, GAP = 150, SPAWN = 1.5;

interface GameState { phase: 'ready' | 'playing' | 'dead'; y: number; v: number; pipes: Pipe[]; spawnT: number; score: number; }

function initial(): GameState { return { phase: 'ready', y: H / 2, v: 0, pipes: [], spawnT: SPAWN, score: 0 }; }

export default function FlappyBird({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const g = useRef<GameState>(initial());
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'dead'>('ready');

  const flap = () => {
    const s = g.current;
    if (s.phase === 'ready') { s.phase = 'playing'; setPhase('playing'); s.v = FLAP; return; }
    if (s.phase === 'dead') { g.current = initial(); setPhase('ready'); return; }
    s.v = FLAP;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    let last = performance.now();

    const draw = (s: GameState) => {
      // sky
      ctx.fillStyle = '#7dd3fc';
      ctx.fillRect(0, 0, W, H);
      // pipes
      ctx.fillStyle = '#16a34a';
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 3;
      for (const p of s.pipes) {
        ctx.fillRect(p.x, 0, PIPE_W, p.gapTop);
        ctx.strokeRect(p.x, 0, PIPE_W, p.gapTop);
        ctx.fillRect(p.x, p.gapBottom, PIPE_W, GROUND - p.gapBottom);
        ctx.strokeRect(p.x, p.gapBottom, PIPE_W, GROUND - p.gapBottom);
      }
      // ground
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(0, GROUND, W, H - GROUND);
      // bird
      ctx.beginPath();
      ctx.arc(BIRD_X, s.y, R, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(BIRD_X + 5, s.y - 4, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      // score
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText(String(s.score), W / 2, 70);
      ctx.fillText(String(s.score), W / 2, 70);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const s = g.current;
      if (s.phase === 'playing') {
        const b = stepBird(s.y, s.v, dt, GRAVITY);
        s.y = b.y; s.v = b.v;
        for (const p of s.pipes) p.x -= SPEED * dt;
        s.spawnT += dt;
        if (s.spawnT >= SPAWN) {
          s.spawnT = 0;
          const gapTop = 50 + Math.random() * (GROUND - GAP - 100);
          s.pipes.push({ x: W, gapTop, gapBottom: gapTop + GAP, scored: false });
        }
        s.pipes = s.pipes.filter(p => p.x + PIPE_W > -10);
        for (const p of s.pipes) {
          if (!p.scored && p.x + PIPE_W < BIRD_X) {
            p.scored = true; s.score += 1;
            setBest(prev => (s.score > prev ? s.score : prev));
          }
        }
        const dead = outOfBounds(s.y, R, GROUND) || s.pipes.some(p => hitsPipe(BIRD_X, s.y, R, p.x, PIPE_W, p.gapTop, p.gapBottom));
        if (dead) { s.phase = 'dead'; setPhase('dead'); }
      }
      draw(s);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); flap(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="relative mx-auto w-full max-w-[360px]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={e => { e.preventDefault(); flap(); }}
          className="w-full cursor-pointer touch-none select-none border-2 border-border"
          style={{ imageRendering: 'auto' }}
        />
        {phase !== 'playing' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-white">
            <div className="rounded bg-black/60 px-4 py-2">
              <div className="text-lg font-black">{phase === 'dead' ? t.dead : t.ready}</div>
              {phase === 'dead' && <div className="text-sm">{t.best}: {best} · {t.restart}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
