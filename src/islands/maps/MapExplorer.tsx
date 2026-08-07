import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { LocateFixed, Ruler, Search, X } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MlMap, Marker as MlMarker, GeoJSONSource } from 'maplibre-gl';
import { themeAtom } from '@/stores/theme.store';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { resolveStyle, MAP_STYLES, haversineMeters, formatDistance, type StyleChoice } from '@/tools/geo/map-styles.lib';
import { ddToDms, ddToUtm, encodeGeohash, formatDd, type LatLng } from '@/tools/geo/coord.lib';
import type { Lang } from '@/i18n/config';

const STYLE_KEY = 'gwt.map.style';
type SearchHit = { name: string; lat: number; lng: number };

const TR: Record<Lang, {
  searchPlace: string;
  style: string;
  measuring: string;
  measure: string;
  clear: string;
  hintMeasure: string;
  hintPin: string;
  attribution: string;
  distance: (dist: string, n: number) => string;
}> = {
  en: {
    searchPlace: 'Search a place…',
    style: 'Style',
    measuring: 'Measuring…',
    measure: 'Measure',
    clear: 'Clear',
    hintMeasure: 'Click points on the map to measure distance.',
    hintPin: 'Click anywhere on the map to drop a pin and read its coordinates.',
    attribution: 'Maps © OpenFreeMap / OpenStreetMap contributors.',
    distance: (dist, n) => `Distance: ${dist} (${n} points)`,
  },
  id: {
    searchPlace: 'Cari tempat…',
    style: 'Gaya',
    measuring: 'Mengukur…',
    measure: 'Ukur',
    clear: 'Bersihkan',
    hintMeasure: 'Klik titik di peta untuk mengukur jarak.',
    hintPin: 'Klik di mana saja pada peta untuk menandai pin dan membaca koordinatnya.',
    attribution: 'Peta © OpenFreeMap / OpenStreetMap contributors.',
    distance: (dist, n) => `Jarak: ${dist} (${n} titik)`,
  },
};

export default function MapExplorer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const theme = useStore(themeAtom);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const mlRef = useRef<typeof import('maplibre-gl') | null>(null);
  const pinMarkerRef = useRef<MlMarker | null>(null);
  const measureMarkersRef = useRef<MlMarker[]>([]);
  const measureRef = useRef<LatLng[]>([]);
  const measuringRef = useRef(false);
  const roRef = useRef<ResizeObserver | null>(null);
  // Track the URL currently loaded by the map to avoid spurious setStyle calls.
  // Calling setStyle with the same URL still triggers a full style reload in
  // MapLibre, which cancels any in-flight tile requests and causes blank tiles.
  const appliedStyleUrl = useRef('');

  const [style, setStyle] = useState<StyleChoice>('auto');
  const [pin, setPin] = useState<LatLng | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [measureDist, setMeasureDist] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { measuringRef.current = measuring; }, [measuring]);

  // Restore saved style choice.
  useEffect(() => {
    try { const s = localStorage.getItem(STYLE_KEY) as StyleChoice | null; if (s) setStyle(s); } catch { /* */ }
  }, []);

  const ensureMeasureLayer = () => {
    const map = mapRef.current;
    if (!map || map.getSource('measure')) return;
    map.addSource('measure', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} } });
    map.addLayer({ id: 'measure-line', type: 'line', source: 'measure', paint: { 'line-color': '#7c3aed', 'line-width': 3, 'line-dasharray': [2, 1] } });
  };

  const refreshMeasureLine = () => {
    const map = mapRef.current;
    const src = map?.getSource('measure') as GeoJSONSource | undefined;
    src?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: measureRef.current.map(p => [p.lng, p.lat]) }, properties: {} });
  };

  const handleClick = (lat: number, lng: number) => {
    const ml = mlRef.current;
    const map = mapRef.current;
    if (!ml || !map) return;
    if (measuringRef.current) {
      measureRef.current.push({ lat, lng });
      const marker = new ml.Marker({ color: '#7c3aed', scale: 0.7 }).setLngLat([lng, lat]).addTo(map);
      measureMarkersRef.current.push(marker);
      let total = 0;
      for (let i = 1; i < measureRef.current.length; i++) total += haversineMeters(measureRef.current[i - 1], measureRef.current[i]);
      setMeasureDist(total);
      refreshMeasureLine();
    } else {
      setPin({ lat, lng });
      if (!pinMarkerRef.current) pinMarkerRef.current = new ml.Marker({ color: '#dc2626' }).setLngLat([lng, lat]).addTo(map);
      else pinMarkerRef.current.setLngLat([lng, lat]);
    }
  };

  // Init the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ml = await import('maplibre-gl');
      if (cancelled || !containerRef.current || mapRef.current) return;
      mlRef.current = ml;
      const initialUrl = resolveStyle(style, theme).url;
      appliedStyleUrl.current = initialUrl;
      const map = new ml.Map({
        container: containerRef.current,
        style: initialUrl,
        center: [106.8272, -6.1751],
        zoom: 3,
        minZoom: 0,
        maxZoom: 20,
      });
      map.addControl(new ml.NavigationControl(), 'top-right');
      map.addControl(new ml.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'top-right');
      map.on('click', e => handleClick(e.lngLat.lat, e.lngLat.lng));
      map.on('style.load', () => { ensureMeasureLayer(); refreshMeasureLine(); });
      map.on('load', () => map.resize());
      // After any pan/zoom animation (flyTo, GeolocateControl, etc.) revalidate the
      // canvas size — without this, MapLibre reports stale dimensions and tiles don't
      // fill the viewport, leaving the map blank.
      // Guard + rAF: calling map.resize() synchronously inside moveend causes MapLibre
      // to fire moveend again from within constrainInternal → stack overflow. Deferring
      // to the next animation frame breaks the synchronous recursion.
      let resizePending = false;
      map.on('moveend', () => {
        if (resizePending) return;
        resizePending = true;
        requestAnimationFrame(() => {
          resizePending = false;
          // resize() is a no-op when canvas dimensions haven't changed, so follow
          // it with triggerRepaint() to ensure tile fetching runs for the new viewport.
          map.resize();
          map.triggerRepaint();
        });
      });
      // The container is mounted via a dynamically-imported island, so it can be
      // laid out after the map is created — resize once it (or its size) settles,
      // otherwise the map renders blank at 0×0.
      const ro = new ResizeObserver(() => map.resize());
      if (containerRef.current) ro.observe(containerRef.current);
      roRef.current = ro;
      mapRef.current = map;
    })();
    return () => { cancelled = true; roRef.current?.disconnect(); mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-style on choice or site-theme change — but only when the URL actually
  // changes. MapLibre reloads the full style (cancelling in-flight tile requests)
  // even when setStyle is called with the same URL, so skip no-op calls.
  useEffect(() => {
    const url = resolveStyle(style, theme).url;
    if (!mapRef.current || url === appliedStyleUrl.current) return;
    appliedStyleUrl.current = url;
    mapRef.current.setStyle(url);
  }, [style, theme]);

  const pickStyle = (s: StyleChoice) => { setStyle(s); try { localStorage.setItem(STYLE_KEY, s); } catch { /* */ } };

  const clearMeasure = () => {
    measureMarkersRef.current.forEach(m => m.remove());
    measureMarkersRef.current = [];
    measureRef.current = [];
    setMeasureDist(0);
    refreshMeasureLine();
  };

  const toggleMeasure = () => {
    if (measuring) clearMeasure();
    setMeasuring(m => !m);
  };

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json' } });
      const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      setResults(data.map(d => ({ name: d.display_name, lat: +d.lat, lng: +d.lon })));
    } catch { setResults([]); } finally { setSearching(false); }
  };

  const goTo = (hit: SearchHit) => {
    setResults([]);
    setQuery(hit.name.split(',')[0]);
    mapRef.current?.flyTo({ center: [hit.lng, hit.lat], zoom: 14 });
    handleClick(hit.lat, hit.lng);
  };

  const myLocation = () => {
    navigator.geolocation?.getCurrentPosition(pos => {
      mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15 });
      handleClick(pos.coords.latitude, pos.coords.longitude);
    });
  };

  const coordRows = pin
    ? [
        { label: 'Decimal', value: formatDd(pin.lat, pin.lng) },
        { label: 'DMS', value: `${ddToDms(pin.lat, pin.lng).lat} ${ddToDms(pin.lat, pin.lng).lng}` },
        { label: 'UTM', value: (() => { const u = ddToUtm(pin.lat, pin.lng); return `${u.zone}${u.hemisphere} ${Math.round(u.easting)}E ${Math.round(u.northing)}N`; })() },
        { label: 'Geohash', value: encodeGeohash(pin.lat, pin.lng, 10) },
      ]
    : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex flex-1 items-center gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search(); }}
            placeholder={t.searchPlace}
            className="w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm"
          />
          <Button variant="secondary" onClick={search} disabled={searching}><Search className="h-4 w-4" /></Button>
          {results.length > 0 && (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-full overflow-y-auto border-2 border-border bg-background shadow-brutal">
              {results.map((r, i) => (
                <button key={i} onClick={() => goTo(r)} className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground">{r.name}</button>
              ))}
            </div>
          )}
        </div>
        <Button variant="secondary" onClick={myLocation}><LocateFixed className="h-4 w-4" /></Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.style}</span>
        {MAP_STYLES.map(s => (
          <Button key={s.id} variant={style === s.id ? 'primary' : 'secondary'} aria-pressed={style === s.id} onClick={() => pickStyle(s.id)}>{s.label}</Button>
        ))}
        <Button variant={measuring ? 'primary' : 'secondary'} onClick={toggleMeasure}><Ruler className="h-4 w-4" /> {measuring ? t.measuring : t.measure}</Button>
        {measuring && measureRef.current.length > 0 && <Button variant="ghost" onClick={clearMeasure}><X className="h-4 w-4" /> {t.clear}</Button>}
      </div>

      <div ref={containerRef} className="h-[60vh] w-full border-2 border-border" />

      <p className="text-xs text-muted-foreground">
        {measuring ? t.hintMeasure : t.hintPin}
        {' '}{t.attribution}
      </p>

      {measuring && measureRef.current.length > 1 && (
        <p className="text-sm font-bold">{t.distance(formatDistance(measureDist), measureRef.current.length)}</p>
      )}

      {pin && !measuring && (
        <div className="space-y-2 border-2 border-border p-3">
          {coordRows.map(r => (
            <div key={r.label} className="flex flex-wrap items-center gap-2">
              <span className="w-24 shrink-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">{r.label}</span>
              <code className="min-w-0 flex-1 break-all border-2 border-border bg-muted px-2 py-1 text-sm">{r.value}</code>
              <CopyButton value={r.value} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
