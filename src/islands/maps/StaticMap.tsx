import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Search, LocateFixed, Download, MapPin } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MlMap, Marker as MlMarker } from 'maplibre-gl';
import { themeAtom } from '@/stores/theme.store';
import { Button } from '@/components/ui/Button';
import { downloadService } from '@/services/download';
import { resolveStyle, MAP_STYLES, type StyleChoice } from '@/tools/geo/map-styles.lib';

const STYLE_KEY = 'gwt.map.style';
type SearchHit = { name: string; lat: number; lng: number };

export default function StaticMap() {
  const theme = useStore(themeAtom);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const mlRef = useRef<typeof import('maplibre-gl') | null>(null);
  const markerRef = useRef<MlMarker | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const [style, setStyle] = useState<StyleChoice>('auto');
  const [pinCenter, setPinCenter] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { try { const s = localStorage.getItem(STYLE_KEY) as StyleChoice | null; if (s) setStyle(s); } catch { /* */ } }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ml = await import('maplibre-gl');
      if (cancelled || !containerRef.current || mapRef.current) return;
      mlRef.current = ml;
      const map = new ml.Map({
        container: containerRef.current,
        style: resolveStyle(style, theme).url,
        center: [2.3522, 48.8566],
        zoom: 11,
        preserveDrawingBuffer: true, // required to read the canvas for PNG export
      });
      map.addControl(new ml.NavigationControl(), 'top-right');
      map.on('load', () => map.resize());
      const ro = new ResizeObserver(() => map.resize());
      if (containerRef.current) ro.observe(containerRef.current);
      roRef.current = ro;
      mapRef.current = map;
    })();
    return () => { cancelled = true; roRef.current?.disconnect(); mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { mapRef.current?.setStyle(resolveStyle(style, theme).url); }, [style, theme]);
  const pickStyle = (s: StyleChoice) => { setStyle(s); try { localStorage.setItem(STYLE_KEY, s); } catch { /* */ } };

  // Toggle a marker at the map centre.
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml) return;
    if (pinCenter) {
      if (!markerRef.current) markerRef.current = new ml.Marker({ color: '#dc2626' });
      const place = () => markerRef.current?.setLngLat(map.getCenter()).addTo(map);
      place();
      map.on('move', place);
      return () => { map.off('move', place); };
    } else {
      markerRef.current?.remove();
    }
  }, [pinCenter]);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json' } });
      const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      setResults(data.map(d => ({ name: d.display_name, lat: +d.lat, lng: +d.lon })));
    } catch { setResults([]); } finally { setSearching(false); }
  };
  const goTo = (hit: SearchHit) => { setResults([]); setQuery(hit.name.split(',')[0]); mapRef.current?.flyTo({ center: [hit.lng, hit.lat], zoom: 13 }); };
  const myLocation = () => navigator.geolocation?.getCurrentPosition(p => mapRef.current?.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 14 }));

  const downloadPng = () => {
    const map = mapRef.current;
    if (!map) return;
    const capture = () => {
      const src = map.getCanvas();
      const out = document.createElement('canvas');
      out.width = src.width;
      out.height = src.height;
      const ctx = out.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(src, 0, 0);
      // Burn in the required attribution.
      const text = '© OpenStreetMap contributors · OpenFreeMap';
      ctx.font = '13px sans-serif';
      const w = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(out.width - w - 14, out.height - 24, w + 14, 24);
      ctx.fillStyle = '#111';
      ctx.fillText(text, out.width - w - 7, out.height - 7);
      out.toBlob(b => { if (b) downloadService.download(b, 'map.png'); }, 'image/png');
    };
    map.once('idle', capture);
    map.triggerRepaint();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex flex-1 items-center gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search(); }} placeholder="Search a place…" className="w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm" />
          <Button variant="secondary" onClick={search} disabled={searching}><Search className="h-4 w-4" /></Button>
          {results.length > 0 && (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-full overflow-y-auto border-2 border-border bg-background shadow-brutal">
              {results.map((r, i) => <button key={i} onClick={() => goTo(r)} className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground">{r.name}</button>)}
            </div>
          )}
        </div>
        <Button variant="secondary" onClick={myLocation}><LocateFixed className="h-4 w-4" /></Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Style</span>
        {MAP_STYLES.map(s => <Button key={s.id} variant={style === s.id ? 'primary' : 'secondary'} aria-pressed={style === s.id} onClick={() => pickStyle(s.id)}>{s.label}</Button>)}
        <Button variant={pinCenter ? 'primary' : 'secondary'} onClick={() => setPinCenter(p => !p)}><MapPin className="h-4 w-4" /> Center pin</Button>
      </div>

      <div ref={containerRef} className="h-[60vh] w-full border-2 border-border" />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={downloadPng}><Download className="h-4 w-4" /> Download PNG</Button>
        <span className="text-xs text-muted-foreground">Pan &amp; zoom to frame your map, then export the current view. Maps © OpenFreeMap / OpenStreetMap.</span>
      </div>
    </div>
  );
}
