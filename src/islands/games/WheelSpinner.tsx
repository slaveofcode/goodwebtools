import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { parseEntries, sliceForAngle } from '@/tools/games/wheel.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Spin the wheel to pick a name or option at random — great for giveaways, picking who goes first, or making a decision. Add one entry per line. Runs entirely in your browser.',
    entries: 'Entries (one per line)', spin: 'Spin', spinning: 'Spinning…', winner: 'Winner', needTwo: 'Add at least two entries to spin.',
  },
  id: {
    intro: 'Putar roda untuk memilih nama atau opsi secara acak — cocok untuk giveaway, menentukan giliran, atau mengambil keputusan. Tambahkan satu entri per baris. Berjalan sepenuhnya di browser Anda.',
    entries: 'Entri (satu per baris)', spin: 'Putar', spinning: 'Memutar…', winner: 'Pemenang', needTwo: 'Tambahkan minimal dua entri untuk memutar.',
  },
};

const COLORS = ['#ef4444', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#6366f1', '#a855f7', '#ec4899'];
const TAU = Math.PI * 2;

export default function WheelSpinner({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [text, setText] = useState('Alice\nBob\nCarol\nDave');
  const [angle, setAngle] = useState(0); // degrees
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const entries = parseEntries(text);

  const draw = (rotationDeg: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;
    ctx.clearRect(0, 0, size, size);
    const n = entries.length;
    if (n === 0) return;
    const per = TAU / n;
    const offset = (rotationDeg * Math.PI) / 180 - Math.PI / 2 - per / 2;
    for (let i = 0; i < n; i++) {
      const start = offset + i * per;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, start + per);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      // label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + per / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#111';
      ctx.font = 'bold 14px sans-serif';
      const label = entries[i].length > 16 ? entries[i].slice(0, 15) + '…' : entries[i];
      ctx.fillText(label, radius - 10, 5);
      ctx.restore();
    }
    // hub
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, TAU);
    ctx.fillStyle = '#111';
    ctx.fill();
  };

  useEffect(() => {
    draw(angle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, angle]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const spin = () => {
    const n = entries.length;
    if (n < 2 || spinning) return;
    setSpinning(true);
    setWinner(null);
    const start = angle;
    const spins = 5 + Math.floor(Math.random() * 4);
    const target = start + spins * 360 + Math.random() * 360;
    const duration = 4200;
    let startTime = 0;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const p = Math.min(1, (ts - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      const current = start + (target - start) * eased;
      setAngle(current);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setSpinning(false);
        // Slice 0 is centred at the top, so shift by half a slice before mapping.
        const idx = sliceForAngle(180 / n - current, n);
        setWinner(entries[idx] ?? null);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t.intro}</p>
        <div className="relative mx-auto w-full max-w-md">
          {/* pointer */}
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1"
            style={{ width: 0, height: 0, borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderTop: '20px solid #111' }} />
          <canvas ref={canvasRef} width={420} height={420} className="w-full rounded-full border-2 border-border" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Button onClick={spin} disabled={spinning || entries.length < 2}>{spinning ? t.spinning : t.spin}</Button>
          {entries.length < 2 && <p className="text-xs text-muted-foreground">{t.needTwo}</p>}
          {winner && !spinning && (
            <div className="border-2 border-border bg-fuchsia-200 px-4 py-2 text-center text-black shadow-brutal dark:bg-fuchsia-900/50 dark:text-white">
              <div className="text-xs font-bold uppercase tracking-wide">{t.winner}</div>
              <div className="text-2xl font-black">{winner}</div>
            </div>
          )}
        </div>
      </div>

      <label className="space-y-1 text-sm">
        <span className="block font-semibold">{t.entries}</span>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={12}
          className="w-full resize-y border-2 border-border bg-muted p-3 text-sm" />
      </label>
    </div>
  );
}
