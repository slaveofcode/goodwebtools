import { useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CopyButton } from '@/components/ui/CopyButton';
import {
  parseLatLng,
  formatDd,
  ddToDms,
  dmsToDd,
  ddToUtm,
  utmToDd,
  encodeGeohash,
  decodeGeohash,
  type LatLng,
} from '@/tools/geo/coord.lib';

type Fmt = 'dd' | 'dms' | 'geohash' | 'utm';

const FORMATS: { value: Fmt; label: string }[] = [
  { value: 'dd', label: 'Decimal (DD)' },
  { value: 'dms', label: 'DMS' },
  { value: 'geohash', label: 'Geohash' },
  { value: 'utm', label: 'UTM' },
];

export default function CoordConvert() {
  const [fmt, setFmt] = useState<Fmt>('dd');
  const [dd, setDd] = useState('-6.2088, 106.8456');
  const [dmsLat, setDmsLat] = useState('');
  const [dmsLng, setDmsLng] = useState('');
  const [geohash, setGeohash] = useState('');
  const [utmZone, setUtmZone] = useState('');
  const [utmHemi, setUtmHemi] = useState<'N' | 'S'>('N');
  const [utmE, setUtmE] = useState('');
  const [utmN, setUtmN] = useState('');
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  const point: LatLng | null = (() => {
    if (fmt === 'dd') return parseLatLng(dd);
    if (fmt === 'dms') return dmsLat && dmsLng ? dmsToDd(dmsLat, dmsLng) : null;
    if (fmt === 'geohash') return geohash ? decodeGeohash(geohash) : null;
    if (fmt === 'utm') {
      const zone = parseInt(utmZone, 10);
      const e = parseFloat(utmE);
      const n = parseFloat(utmN);
      if (!zone || !Number.isFinite(e) || !Number.isFinite(n)) return null;
      return utmToDd({ zone, hemisphere: utmHemi, easting: e, northing: n });
    }
    return null;
  })();

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation isn’t available in this browser.'); return; }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      pos => { setFmt('dd'); setDd(formatDd(pos.coords.latitude, pos.coords.longitude)); setLocating(false); },
      () => { setError('Couldn’t get your location (permission denied or unavailable).'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const outputs = point
    ? (() => {
        const dms = ddToDms(point.lat, point.lng);
        const utm = ddToUtm(point.lat, point.lng);
        return [
          { label: 'Decimal (DD)', value: formatDd(point.lat, point.lng) },
          { label: 'DMS', value: `${dms.lat} ${dms.lng}` },
          { label: 'UTM', value: `${utm.zone}${utm.hemisphere} ${Math.round(utm.easting)}E ${Math.round(utm.northing)}N` },
          { label: 'Geohash', value: encodeGeohash(point.lat, point.lng, 10) },
          { label: 'Map link', value: `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=15/${point.lat}/${point.lng}` },
        ];
      })()
    : [];

  const inputCls = 'w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Input format</span>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map(f => (
            <Button key={f.value} variant={fmt === f.value ? 'primary' : 'secondary'} aria-pressed={fmt === f.value} onClick={() => { setFmt(f.value); setError(''); }}>
              {f.label}
            </Button>
          ))}
          <Button variant="secondary" onClick={useMyLocation} disabled={locating}>
            <LocateFixed className="h-4 w-4" /> {locating ? 'Locating…' : 'My location'}
          </Button>
        </div>
      </div>

      {fmt === 'dd' && (
        <label className="block space-y-1.5">
          <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Latitude, Longitude</span>
          <input value={dd} onChange={e => setDd(e.target.value)} placeholder="-6.2088, 106.8456" className={inputCls} />
        </label>
      )}
      {fmt === 'dms' && (
        <div className="flex flex-wrap gap-3">
          <label className="flex-1 space-y-1.5">
            <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Latitude</span>
            <input value={dmsLat} onChange={e => setDmsLat(e.target.value)} placeholder={`6°12'31.7"S`} className={inputCls} />
          </label>
          <label className="flex-1 space-y-1.5">
            <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Longitude</span>
            <input value={dmsLng} onChange={e => setDmsLng(e.target.value)} placeholder={`106°50'44.2"E`} className={inputCls} />
          </label>
        </div>
      )}
      {fmt === 'geohash' && (
        <label className="block space-y-1.5">
          <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Geohash</span>
          <input value={geohash} onChange={e => setGeohash(e.target.value)} placeholder="qqguwptbm5" className={inputCls} />
        </label>
      )}
      {fmt === 'utm' && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-20 space-y-1.5">
            <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Zone</span>
            <input value={utmZone} onChange={e => setUtmZone(e.target.value)} placeholder="48" className={inputCls} />
          </label>
          <label className="space-y-1.5">
            <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Hemi</span>
            <select value={utmHemi} onChange={e => setUtmHemi(e.target.value as 'N' | 'S')} className={inputCls}>
              <option value="N">N</option>
              <option value="S">S</option>
            </select>
          </label>
          <label className="flex-1 space-y-1.5">
            <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Easting</span>
            <input value={utmE} onChange={e => setUtmE(e.target.value)} placeholder="700000" className={inputCls} />
          </label>
          <label className="flex-1 space-y-1.5">
            <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Northing</span>
            <input value={utmN} onChange={e => setUtmN(e.target.value)} placeholder="9312000" className={inputCls} />
          </label>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {outputs.length > 0 ? (
        <div className="space-y-2 border-2 border-border p-3">
          {outputs.map(o => (
            <div key={o.label} className="flex flex-wrap items-center gap-2">
              <span className="w-28 shrink-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">{o.label}</span>
              <code className="min-w-0 flex-1 break-all border-2 border-border bg-muted px-2 py-1 text-sm">{o.value}</code>
              <CopyButton value={o.value} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Enter a valid coordinate to see every format.</p>
      )}
    </div>
  );
}
