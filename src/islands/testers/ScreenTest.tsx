import { useCallback, useEffect, useRef, useState } from 'react';
import { Monitor } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TEST_COLORS, stepIndex } from '@/tools/testers/screen-test.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; start: string; hint: string; overlay: string; exit: string; colors: string }> = {
  en: {
    intro: 'Check your screen for dead or stuck pixels, backlight bleed and uniformity. Cycle through fullscreen solid colours — a dead pixel stays black on white, a stuck pixel shows colour on black. Look closely at each colour.',
    start: 'Start fullscreen test',
    hint: 'Tip: clean the screen first so dust is not mistaken for a dead pixel.',
    overlay: 'Click / tap or → for next · ← for previous · Esc to exit',
    exit: 'Exit', colors: 'Colours cycled',
  },
  id: {
    intro: 'Periksa layar Anda untuk piksel mati atau macet, kebocoran cahaya latar, dan keseragaman. Putar warna solid layar penuh — piksel mati tetap hitam di atas putih, piksel macet menampilkan warna di atas hitam. Amati tiap warna dengan teliti.',
    start: 'Mulai tes layar penuh',
    hint: 'Tip: bersihkan layar dulu agar debu tidak dikira piksel mati.',
    overlay: 'Klik / ketuk atau → untuk berikutnya · ← sebelumnya · Esc keluar',
    exit: 'Keluar', colors: 'Warna diputar',
  },
};

export default function ScreenTest({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const exit = useCallback(() => {
    setActive(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  const start = async () => {
    setIndex(0);
    setActive(true);
    try { await containerRef.current?.requestFullscreen(); } catch { /* fullscreen optional */ }
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { exit(); return; }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setIndex(i => stepIndex(i, 1)); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setIndex(i => stepIndex(i, -1)); }
    };
    const onFsChange = () => { if (!document.fullscreenElement) setActive(false); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFsChange); };
  }, [active, exit]);

  const color = TEST_COLORS[index];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      <Button onClick={start}><Monitor className="h-4 w-4" /> {t.start}</Button>
      <p className="text-xs text-muted-foreground">{t.hint}</p>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-muted-foreground">{t.colors}:</span>
        {TEST_COLORS.map(c => (
          <span key={c.name} className="h-4 w-4 rounded border border-border" style={{ backgroundColor: c.hex }} title={c.name} />
        ))}
      </div>

      {/* Fullscreen overlay — always mounted so requestFullscreen has a target. */}
      <div
        ref={containerRef}
        onClick={() => setIndex(i => stepIndex(i, 1))}
        className={active ? 'fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center' : 'hidden'}
        style={{ backgroundColor: color.hex, color: color.fg }}
      >
        {active && (
          <div className="pointer-events-none select-none text-center text-sm opacity-70">
            <div className="text-lg font-bold">{color.name}</div>
            <div>{t.overlay}</div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); exit(); }}
              className="pointer-events-auto mt-3 rounded border border-current px-3 py-1 text-xs"
            >
              {t.exit}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
