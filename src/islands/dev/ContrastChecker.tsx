import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { parseColor, contrastRatio, wcagLevels } from '@/tools/dev/contrast.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; fg: string; bg: string; swap: string; ratio: string;
  preview: string; sampleNormal: string; sampleLarge: string;
  normalText: string; largeText: string; pass: string; fail: string; hint: string;
}> = {
  en: {
    intro: 'Check the colour contrast between text and its background against WCAG 2.1. Pick two colours and see the contrast ratio and whether it passes AA and AAA for normal and large text. Runs in your browser.',
    fg: 'Text colour', bg: 'Background', swap: 'Swap', ratio: 'Contrast ratio',
    preview: 'Preview', sampleNormal: 'Normal text — the quick brown fox jumps over the lazy dog.',
    sampleLarge: 'Large text sample',
    normalText: 'Normal text', largeText: 'Large text', pass: 'Pass', fail: 'Fail',
    hint: 'Large text is 18pt+ (or 14pt+ bold). AAA is the strictest level.',
  },
  id: {
    intro: 'Periksa kontras warna antara teks dan latarnya terhadap WCAG 2.1. Pilih dua warna dan lihat rasio kontras serta apakah lolos AA dan AAA untuk teks normal dan besar. Berjalan di browser Anda.',
    fg: 'Warna teks', bg: 'Latar', swap: 'Tukar', ratio: 'Rasio kontras',
    preview: 'Pratinjau', sampleNormal: 'Teks normal — rubah cokelat gesit melompati anjing malas.',
    sampleLarge: 'Contoh teks besar',
    normalText: 'Teks normal', largeText: 'Teks besar', pass: 'Lolos', fail: 'Gagal',
    hint: 'Teks besar adalah 18pt+ (atau 14pt+ tebal). AAA adalah level paling ketat.',
  },
};

function Badge({ ok, label, pass, fail }: { ok: boolean; label: string; pass: string; fail: string }) {
  return (
    <div className={`flex items-center justify-between border-2 border-border px-3 py-2 text-sm ${ok ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
      <span className="font-semibold">{label}</span>
      <span className="font-black">{ok ? `✓ ${pass}` : `✕ ${fail}`}</span>
    </div>
  );
}

export default function ContrastChecker({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [fg, setFg] = useState('#1a1a1a');
  const [bg, setBg] = useState('#ffffff');

  const { ratio, levels, fgOk, bgOk } = useMemo(() => {
    const f = parseColor(fg);
    const b = parseColor(bg);
    if (!f || !b) return { ratio: 0, levels: wcagLevels(0), fgOk: !!f, bgOk: !!b };
    const r = contrastRatio(f, b);
    return { ratio: r, levels: wcagLevels(r), fgOk: true, bgOk: true };
  }, [fg, bg]);

  const swap = () => { setFg(bg); setBg(fg); };

  const colorField = (label: string, value: string, set: (v: string) => void, ok: boolean) => (
    <div className="space-y-1 text-sm">
      <span className="block font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={parseColor(value) ? value : '#000000'} onChange={e => set(e.target.value)}
          aria-label={label} className="h-10 w-12 cursor-pointer border-2 border-border bg-transparent p-0.5" />
        <input type="text" value={value} onChange={e => set(e.target.value)}
          className={`w-32 border-2 bg-muted p-2 font-mono text-sm ${ok ? 'border-border' : 'border-red-500'}`} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex flex-wrap items-end gap-4">
        {colorField(t.fg, fg, setFg, fgOk)}
        <Button variant="secondary" onClick={swap} className="text-xs">⇄ {t.swap}</Button>
        {colorField(t.bg, bg, setBg, bgOk)}
      </div>

      <div className="border-2 border-border p-4 text-center shadow-brutal">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.ratio}</div>
        <div className="text-5xl font-black tabular-nums">{ratio.toFixed(2)}<span className="text-2xl">:1</span></div>
      </div>

      {fgOk && bgOk && (
        <div className="space-y-3">
          <div className="border-2 border-border p-4" style={{ background: bg, color: fg }}>
            <div className="text-xs font-bold uppercase tracking-wide opacity-70">{t.preview}</div>
            <p className="mt-1 text-base">{t.sampleNormal}</p>
            <p className="mt-1 text-2xl font-bold">{t.sampleLarge}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="text-sm font-bold">{t.normalText}</span>
              <Badge ok={levels.normalAA} label="AA (4.5:1)" pass={t.pass} fail={t.fail} />
              <Badge ok={levels.normalAAA} label="AAA (7:1)" pass={t.pass} fail={t.fail} />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-bold">{t.largeText}</span>
              <Badge ok={levels.largeAA} label="AA (3:1)" pass={t.pass} fail={t.fail} />
              <Badge ok={levels.largeAAA} label="AAA (4.5:1)" pass={t.pass} fail={t.fail} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t.hint}</p>
        </div>
      )}
    </div>
  );
}
