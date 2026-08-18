import { useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { buttonName, isDoubleClick, scrollDirection, type Point } from '@/tools/testers/mouse.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; area: string; buttons: string; dbl: string; dblGood: string; dblDrift: string; scroll: string;
  clicks: string; last: string; reset: string; none: string; hint: string;
}> = {
  en: {
    intro: 'Test your mouse: check the left, middle and right buttons, scroll wheel, and whether double-clicks register cleanly. A dying mouse drops the second click or drifts — this catches both. Nothing is uploaded.',
    area: 'Click, double-click and scroll inside this box',
    buttons: 'Buttons', dbl: 'Double-click', dblGood: 'Clean double-click ✓', dblDrift: 'Drifted / too slow ✗', scroll: 'Scroll',
    clicks: 'Total clicks', last: 'Last', reset: 'Reset', none: '—',
    hint: 'Middle = scroll wheel press. Right-click menu is suppressed inside the box.',
  },
  id: {
    intro: 'Uji mouse Anda: periksa tombol kiri, tengah, kanan, roda gulir, dan apakah klik ganda terdaftar bersih. Mouse yang sekarat menjatuhkan klik kedua atau bergeser — ini menangkap keduanya. Tidak ada yang diunggah.',
    area: 'Klik, klik ganda, dan gulir di dalam kotak ini',
    buttons: 'Tombol', dbl: 'Klik ganda', dblGood: 'Klik ganda bersih ✓', dblDrift: 'Bergeser / terlalu lambat ✗', scroll: 'Gulir',
    clicks: 'Total klik', last: 'Terakhir', reset: 'Atur ulang', none: '—',
    hint: 'Tengah = tekan roda gulir. Menu klik-kanan dinonaktifkan di dalam kotak.',
  },
};

export default function MouseTest({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [buttons, setButtons] = useState<Set<number>>(new Set());
  const [scrolls, setScrolls] = useState<Set<number>>(new Set());
  const [clicks, setClicks] = useState(0);
  const [last, setLast] = useState('');
  const [dbl, setDbl] = useState<null | boolean>(null);
  const prevClick = useRef<{ t: number; p: Point } | null>(null);

  const onDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const now = e.timeStamp;
    const p = { x: e.clientX, y: e.clientY };
    setButtons(b => new Set(b).add(e.button));
    setClicks(c => c + 1);
    setLast(`${buttonName(e.button)} @ ${Math.round(p.x)},${Math.round(p.y)}`);
    if (prevClick.current) setDbl(isDoubleClick(prevClick.current.t, now, prevClick.current.p, p));
    prevClick.current = { t: now, p };
  };

  const onWheel = (e: React.WheelEvent) => {
    const d = scrollDirection(e.deltaY);
    if (d !== 0) setScrolls(s => new Set(s).add(d));
  };

  const reset = () => { setButtons(new Set()); setScrolls(new Set()); setClicks(0); setLast(''); setDbl(null); prevClick.current = null; };

  const chip = (on: boolean, label: string) => (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${on ? 'bg-emerald-500/80 text-white' : 'bg-background text-muted-foreground border border-border'}`}>{label}</span>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div
        onMouseDown={onDown}
        onWheel={onWheel}
        onContextMenu={e => e.preventDefault()}
        className="flex h-56 cursor-crosshair select-none items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted text-center text-sm text-muted-foreground"
      >
        {t.area}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs font-semibold text-muted-foreground">{t.buttons}</p>
          <div className="flex flex-wrap gap-1.5">
            {chip(buttons.has(0), 'Left')}
            {chip(buttons.has(1), 'Middle')}
            {chip(buttons.has(2), 'Right')}
          </div>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">{t.scroll}</p>
          <div className="flex flex-wrap gap-1.5">
            {chip(scrolls.has(-1), '↑ Up')}
            {chip(scrolls.has(1), '↓ Down')}
          </div>
        </div>
        <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">{t.clicks}</span><strong>{clicks}</strong></div>
          <div className="flex justify-between gap-2"><span className="text-muted-foreground">{t.last}</span><span className="font-mono text-xs">{last || t.none}</span></div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{t.dbl}</span>
            <span className={dbl === null ? 'text-muted-foreground' : dbl ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
              {dbl === null ? t.none : dbl ? t.dblGood : t.dblDrift}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-4 w-4" /> {t.reset}</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t.hint}</p>
    </div>
  );
}
