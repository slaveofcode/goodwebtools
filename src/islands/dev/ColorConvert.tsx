import { useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseColor(value: string): Rgb | null {
  const text = value.trim().toLowerCase();

  // #rgb / #rrggbb
  const hexMatch = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  // rgb(r, g, b)
  const rgbMatch = text.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (rgbMatch) {
    const [r, g, b] = [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map(Number);
    if ([r, g, b].every(n => n >= 0 && n <= 255)) return { r, g, b };
  }

  return null;
}

function toHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
}

function toHsl({ r, g, b }: Rgb): string {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return `hsl(${h}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

export default function ColorConvert() {
  const [input, setInput] = useState('#7c3aed');

  const rgb = parseColor(input);
  const invalid = input.trim() !== '' && rgb === null;

  const rows: [string, string][] = rgb
    ? [
        ['HEX', toHex(rgb)],
        ['RGB', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`],
        ['HSL', toHsl(rgb)],
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="min-w-[12rem] flex-1 space-y-1.5">
          <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Color
          </span>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="#7c3aed or rgb(124, 58, 237)"
            className="w-full border-2 border-border bg-muted px-3 py-2 font-mono text-sm outline-none focus:shadow-brutal-sm"
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Pick
          </span>
          <input
            type="color"
            value={rgb ? toHex(rgb) : '#000000'}
            onChange={e => setInput(e.target.value)}
            className="h-11 w-16 cursor-pointer border-2 border-border bg-muted"
          />
        </label>
      </div>

      {invalid && <Alert variant="error">Enter a hex (#rrggbb) or rgb(r, g, b) color.</Alert>}

      {rgb && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div
            className="h-28 w-full border-2 border-border shadow-brutal sm:w-40"
            style={{ backgroundColor: toHex(rgb) }}
            aria-label="Color preview"
          />
          <div className="flex-1 divide-y-2 divide-border border-2 border-border">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 bg-muted p-3">
                <div className="min-w-0">
                  <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                  <code className="block break-all text-sm">{value}</code>
                </div>
                <CopyButton value={value} label="" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
