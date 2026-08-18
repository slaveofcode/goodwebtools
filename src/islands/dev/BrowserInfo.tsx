import { useEffect, useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import { parseUserAgent } from '@/tools/dev/browser-info.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; copyAll: string; groups: { browser: string; display: string; device: string; locale: string } }> = {
  en: {
    intro: 'See what your browser reports about itself — user agent, browser & OS, screen and viewport size, timezone and more. Nothing is uploaded; this reads only what your own browser exposes to any web page.',
    copyAll: 'Copy all as JSON',
    groups: { browser: 'Browser', display: 'Screen & viewport', device: 'Device', locale: 'Locale & network' },
  },
  id: {
    intro: 'Lihat apa yang dilaporkan browser Anda tentang dirinya — user agent, browser & OS, ukuran layar dan viewport, zona waktu, dan lainnya. Tidak ada yang diunggah; ini hanya membaca yang diekspos browser Anda ke halaman web mana pun.',
    copyAll: 'Salin semua sebagai JSON',
    groups: { browser: 'Browser', display: 'Layar & viewport', device: 'Perangkat', locale: 'Bahasa & jaringan' },
  },
};

type Row = { label: string; value: string };
type Info = { browser: Row[]; display: Row[]; device: Row[]; locale: Row[]; all: Record<string, string> };

// navigator.deviceMemory is non-standard and not in the TS lib types.
interface ExtraNavigator extends Navigator {
  deviceMemory?: number;
}

function collect(): Info {
  const nav = navigator as ExtraNavigator;
  const ua = nav.userAgent;
  const parsed = parseUserAgent(ua);
  const dpr = window.devicePixelRatio || 1;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '—';
  const langs = nav.languages && nav.languages.length ? nav.languages.join(', ') : nav.language || '—';

  const browser: Row[] = [
    { label: 'User agent', value: ua },
    { label: 'Browser', value: `${parsed.browser}${parsed.browserVersion ? ' ' + parsed.browserVersion : ''}` },
    { label: 'Engine', value: parsed.engine },
    { label: 'Operating system', value: parsed.os },
  ];
  const display: Row[] = [
    { label: 'Screen resolution', value: `${screen.width} × ${screen.height}` },
    { label: 'Available screen', value: `${screen.availWidth} × ${screen.availHeight}` },
    { label: 'Viewport (window)', value: `${window.innerWidth} × ${window.innerHeight}` },
    { label: 'Device pixel ratio', value: String(dpr) },
    { label: 'Color depth', value: `${screen.colorDepth}-bit` },
    { label: 'Orientation', value: screen.orientation?.type ?? '—' },
  ];
  const device: Row[] = [
    { label: 'CPU cores (logical)', value: nav.hardwareConcurrency ? String(nav.hardwareConcurrency) : '—' },
    { label: 'Device memory', value: nav.deviceMemory ? `${nav.deviceMemory} GB (approx.)` : '—' },
    { label: 'Touch points', value: String(nav.maxTouchPoints ?? 0) },
    { label: 'Platform', value: nav.platform || '—' },
  ];
  const locale: Row[] = [
    { label: 'Languages', value: langs },
    { label: 'Timezone', value: tz },
    { label: 'Cookies enabled', value: nav.cookieEnabled ? 'Yes' : 'No' },
    { label: 'Online', value: nav.onLine ? 'Yes' : 'No' },
    { label: 'Do Not Track', value: nav.doNotTrack === '1' ? 'Enabled' : 'Not enabled' },
  ];

  const all: Record<string, string> = {};
  for (const r of [...browser, ...display, ...device, ...locale]) all[r.label] = r.value;
  return { browser, display, device, locale, all };
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {rows.map(r => (
          <li key={r.label} className="flex items-start gap-3 bg-muted/40 px-3 py-2">
            <span className="w-40 shrink-0 text-sm text-muted-foreground">{r.label}</span>
            <span className="min-w-0 flex-1 break-all font-mono text-sm">{r.value}</span>
            <CopyButton value={r.value} label="" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function BrowserInfo({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    const update = () => setInfo(collect());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!info) return <p className="text-sm text-muted-foreground">{t.intro}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t.intro}</p>
        <CopyButton value={JSON.stringify(info.all, null, 2)} label={t.copyAll} />
      </div>
      <Section title={t.groups.browser} rows={info.browser} />
      <Section title={t.groups.display} rows={info.display} />
      <Section title={t.groups.device} rows={info.device} />
      <Section title={t.groups.locale} rows={info.locale} />
    </div>
  );
}
