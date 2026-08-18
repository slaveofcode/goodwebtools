import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { KEY_ROWS, allCodes, isKnownCode, testedCount } from '@/tools/testers/keyboard.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; tested: string; reset: string; lastKey: string; hint: string; none: string }> = {
  en: {
    intro: 'Test every key on your keyboard — press each one and watch it light up. Keys you have pressed turn green, so a dead key is the one that never changes. Nothing is sent anywhere.',
    tested: 'Keys tested', reset: 'Reset', lastKey: 'Last key', hint: 'Click here first, then press keys. Held keys glow; tested keys stay green.',
    none: '—',
  },
  id: {
    intro: 'Uji setiap tombol keyboard Anda — tekan satu per satu dan lihat menyala. Tombol yang sudah ditekan menjadi hijau, jadi tombol mati adalah yang tidak pernah berubah. Tidak ada yang dikirim ke mana pun.',
    tested: 'Tombol diuji', reset: 'Atur ulang', lastKey: 'Tombol terakhir', hint: 'Klik di sini dulu, lalu tekan tombol. Tombol ditahan menyala; tombol teruji tetap hijau.',
    none: '—',
  },
};

// Keys that would scroll or navigate the page while testing.
const PREVENT = new Set(['Space', 'Tab', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Quote', 'Slash']);

export default function KeyboardTest({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [tested, setTested] = useState<Set<string>>(new Set());
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [lastKey, setLastKey] = useState('');

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isKnownCode(e.code) && PREVENT.has(e.code)) e.preventDefault();
      setLastKey(`${e.key === ' ' ? 'Space' : e.key}  ·  ${e.code}`);
      setPressed(p => new Set(p).add(e.code));
      setTested(prev => { const n = new Set(prev); n.add(e.code); return n; });
    };
    const up = (e: KeyboardEvent) => setPressed(p => { const n = new Set(p); n.delete(e.code); return n; });
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const total = allCodes().length;
  const done = testedCount(tested);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
        <span>{t.tested}: <strong>{done} / {total}</strong></span>
        <span className="text-muted-foreground">{t.lastKey}: <span className="font-mono">{lastKey || t.none}</span></span>
        <Button variant="ghost" size="sm" onClick={() => { setTested(new Set()); setPressed(new Set()); setLastKey(''); }}>
          <RotateCcw className="h-4 w-4" /> {t.reset}
        </Button>
      </div>

      <div className="space-y-1 overflow-x-auto rounded-lg border-2 border-border bg-muted p-2 sm:p-3" tabIndex={0}>
        {KEY_ROWS.map((row, ri) => (
          <div key={ri} className="flex gap-1">
            {row.map(k => {
              const isPressed = pressed.has(k.code);
              const isTested = tested.has(k.code);
              const bg = isPressed ? 'bg-accent text-accent-foreground border-accent'
                : isTested ? 'bg-emerald-500/80 text-white border-emerald-600'
                : 'bg-background text-foreground border-border';
              return (
                <div
                  key={k.code}
                  className={`flex h-9 min-w-0 items-center justify-center rounded border text-[11px] font-medium ${bg}`}
                  style={{ flexGrow: k.w ?? 1, flexBasis: 0 }}
                  title={k.code}
                >
                  <span className="truncate px-1">{k.label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t.hint}</p>
    </div>
  );
}
