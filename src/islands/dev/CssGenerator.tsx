import { useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import { linearGradientCss, radialGradientCss, boxShadowCss, borderRadiusCss } from '@/tools/dev/css-generators.lib';
import type { Lang } from '@/i18n/config';

type Tab = 'gradient' | 'shadow' | 'radius';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Generate CSS for gradients, box-shadows and border-radius with a live preview — copy the code straight into your stylesheet. Runs in your browser.',
    gradient: 'Gradient', shadow: 'Box shadow', radius: 'Border radius',
    type: 'Type', linear: 'Linear', radial: 'Radial', angle: 'Angle', color1: 'Color 1', color2: 'Color 2',
    x: 'Offset X', y: 'Offset Y', blur: 'Blur', spread: 'Spread', color: 'Color', inset: 'Inset',
    tl: 'Top-left', tr: 'Top-right', br: 'Bottom-right', bl: 'Bottom-left', copy: 'Copy CSS',
  },
  id: {
    intro: 'Buat CSS untuk gradien, box-shadow, dan border-radius dengan pratinjau langsung — salin kodenya langsung ke stylesheet Anda. Berjalan di browser Anda.',
    gradient: 'Gradien', shadow: 'Box shadow', radius: 'Border radius',
    type: 'Tipe', linear: 'Linear', radial: 'Radial', angle: 'Sudut', color1: 'Warna 1', color2: 'Warna 2',
    x: 'Offset X', y: 'Offset Y', blur: 'Blur', spread: 'Spread', color: 'Warna', inset: 'Inset',
    tl: 'Kiri-atas', tr: 'Kanan-atas', br: 'Kanan-bawah', bl: 'Kiri-bawah', copy: 'Salin CSS',
  },
};

function Slider({ label, value, set, min, max }: { label: string; value: number; set: (n: number) => void; min: number; max: number }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="flex justify-between"><span className="font-semibold">{label}</span><span className="font-mono text-muted-foreground">{value}</span></span>
      <input type="range" min={min} max={max} value={value} onChange={e => set(Number(e.target.value))} className="w-full accent-accent" />
    </label>
  );
}

export default function CssGenerator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [tab, setTab] = useState<Tab>('gradient');

  const [gType, setGType] = useState<'linear' | 'radial'>('linear');
  const [angle, setAngle] = useState(90);
  const [c1, setC1] = useState('#7c3aed');
  const [c2, setC2] = useState('#22d3ee');

  const [sx, setSx] = useState(4); const [sy, setSy] = useState(6); const [sblur, setSblur] = useState(16);
  const [sspread, setSspread] = useState(0); const [scolor, setScolor] = useState('#00000040'); const [sinset, setSinset] = useState(false);

  const [tl, setTl] = useState(16); const [tr, setTr] = useState(16); const [br, setBr] = useState(16); const [bl, setBl] = useState(16);

  const gradient = gType === 'linear'
    ? linearGradientCss(angle, [{ color: c1, pos: 0 }, { color: c2, pos: 100 }])
    : radialGradientCss('circle', [{ color: c1, pos: 0 }, { color: c2, pos: 100 }]);
  const shadow = boxShadowCss({ x: sx, y: sy, blur: sblur, spread: sspread, color: scolor, inset: sinset });
  const radius = borderRadiusCss(tl, tr, br, bl);

  const css = tab === 'gradient' ? `background: ${gradient};`
    : tab === 'shadow' ? `box-shadow: ${shadow};`
    : `border-radius: ${radius};`;

  const previewStyle: React.CSSProperties = tab === 'gradient' ? { background: gradient }
    : tab === 'shadow' ? { boxShadow: shadow, background: 'var(--tw-prose-body, #fff)' }
    : { borderRadius: radius, background: gradient };

  const input = 'w-full border-2 border-border bg-muted p-1.5 text-sm';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex gap-1">
        {(['gradient', 'shadow', 'radius'] as const).map(x => (
          <button key={x} onClick={() => setTab(x)} aria-pressed={tab === x}
            className={`border-2 px-4 py-2 text-sm font-bold uppercase tracking-wide ${tab === x ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border'}`}>
            {t[x]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <div className="space-y-3">
          {tab === 'gradient' && (
            <>
              <div className="flex gap-1 text-sm">
                {(['linear', 'radial'] as const).map(g => (
                  <button key={g} onClick={() => setGType(g)} aria-pressed={gType === g}
                    className={`border-2 px-3 py-1 font-medium ${gType === g ? 'border-border bg-accent text-accent-foreground' : 'border-border'}`}>{t[g]}</button>
                ))}
              </div>
              {gType === 'linear' && <Slider label={t.angle} value={angle} set={setAngle} min={0} max={360} />}
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm"><span className="font-semibold">{t.color1}</span><input type="color" value={c1} onChange={e => setC1(e.target.value)} className="h-9 w-full border-2 border-border" /></label>
                <label className="space-y-1 text-sm"><span className="font-semibold">{t.color2}</span><input type="color" value={c2} onChange={e => setC2(e.target.value)} className="h-9 w-full border-2 border-border" /></label>
              </div>
            </>
          )}
          {tab === 'shadow' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Slider label={t.x} value={sx} set={setSx} min={-50} max={50} />
                <Slider label={t.y} value={sy} set={setSy} min={-50} max={50} />
                <Slider label={t.blur} value={sblur} set={setSblur} min={0} max={100} />
                <Slider label={t.spread} value={sspread} set={setSspread} min={-50} max={50} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm"><span className="font-semibold">{t.color}</span><input value={scolor} onChange={e => setScolor(e.target.value)} className={input} /></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sinset} onChange={e => setSinset(e.target.checked)} className="h-4 w-4 accent-accent" /><span className="font-semibold">{t.inset}</span></label>
              </div>
            </>
          )}
          {tab === 'radius' && (
            <div className="grid grid-cols-2 gap-3">
              <Slider label={t.tl} value={tl} set={setTl} min={0} max={100} />
              <Slider label={t.tr} value={tr} set={setTr} min={0} max={100} />
              <Slider label={t.bl} value={bl} set={setBl} min={0} max={100} />
              <Slider label={t.br} value={br} set={setBr} min={0} max={100} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-center border-2 border-border bg-[repeating-conic-gradient(#e5e5e5_0_25%,#fff_0_50%)] bg-[length:20px_20px] p-6">
          <div className="h-28 w-28" style={previewStyle} />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">CSS</span>
          <CopyButton value={css} label={t.copy} />
        </div>
        <textarea readOnly value={css} rows={2} className="w-full border-2 border-border bg-muted p-2 font-mono text-sm" />
      </div>
    </div>
  );
}
