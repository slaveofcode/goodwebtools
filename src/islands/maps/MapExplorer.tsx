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

// Pre-fetch a MapLibre style URL through our proxy, inline any TileJSON-backed
// vector sources, and rewrite all remaining OFM URLs so every subsequent fetch
// (glyphs, sprites, tiles) also goes through the same-origin proxy.
//
// IMPORTANT: All rewritten URLs must be absolute. MapLibre rejects relative
// sprite/glyph URLs outright, and Web Workers resolve relative tile URLs
// against their own blob URL (not the page origin), causing silent failures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchResolvedStyle(url: string): Promise<string | Record<string, any>> {
  // Build absolute proxy base at call time — location is always available here
  // (this function is only called inside useEffect, never during SSR).
  const proxyBase = `${location.origin}/ofm/`;
  const ofm = (u: unknown): unknown =>
    typeof u === 'string' ? u.replace('https://tiles.openfreemap.org/', proxyBase) : u;

  try {
    const res = await fetch(url, { cache: 'no-cache' });
    console.log('[map] style fetch', url, res.status, res.ok);
    if (!res.ok) return url;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const style = await res.json() as Record<string, any>;
    if (!style.version || !style.sources) {
      console.warn('[map] style response invalid (no version/sources):', JSON.stringify(style).slice(0, 200));
      return url;
    }
    // Rewrite top-level glyph/sprite URLs through our proxy
    if (typeof style.glyphs === 'string') style.glyphs = ofm(style.glyphs);
    if (typeof style.sprite === 'string') style.sprite = ofm(style.sprite);
    // Rewrite sources and inline vector TileJSON
    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.values(style.sources).map(async (src) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = src as Record<string, any>;
        // Rewrite any existing raster tile URLs
        if (Array.isArray(s.tiles)) s.tiles = s.tiles.map(ofm);
        // Inline vector TileJSON and rewrite tile URLs through proxy
        if (s.type === 'vector' && typeof s.url === 'string' && !s.tiles) {
          const tjUrl = ofm(s.url) as string;
          try {
            console.log('[map] fetching TileJSON', tjUrl);
            const tj = await fetch(tjUrl, { cache: 'no-cache' }).then(r => r.json()) as {
              tiles?: string[]; minzoom?: number; maxzoom?: number;
            };
            console.log('[map] TileJSON tiles[0]:', tj.tiles?.[0], 'maxzoom:', tj.maxzoom);
            if (tj.tiles?.length) {
              s.tiles = tj.tiles.map(ofm);
              if (tj.minzoom != null) s.minzoom = tj.minzoom;
              if (tj.maxzoom != null) s.maxzoom = tj.maxzoom;
              delete s.url;
            }
          } catch (e) {
            console.error('[map] TileJSON fetch failed:', e);
            s.url = tjUrl; // leave the proxy URL so MapLibre can retry via proxy
          }
        }
      })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const omt = style.sources?.openmaptiles;
    console.log('[map] openmaptiles source after resolve:', omt?.tiles?.[0] ?? '(still url-based: ' + omt?.url + ')');
    return style;
  } catch (e) {
    console.error('[map] fetchResolvedStyle failed:', e);
    return url;
  }
}

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
      // Fetch style + resolve inline TileJSON before creating the map so MapLibre
      // never needs its own TileJSON fetch (avoids stale CDN edge responses).
      const styleInput = await fetchResolvedStyle(initialUrl);
      if (cancelled || !containerRef.current) return;

      // Diagnostic: probe one vector tile to verify the proxy returns valid PBF.
      // Valid gzip-PBF starts with bytes 1f 8b; raw PBF starts with a protobuf tag.
      // HTML/JSON/text responses (corrupted edge cache) start with ASCII bytes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const omtTiles = (styleInput as any)?.sources?.openmaptiles?.tiles;
      if (Array.isArray(omtTiles) && omtTiles[0]) {
        const probeUrl = (omtTiles[0] as string).replace('{z}', '5').replace('{x}', '26').replace('{y}', '16');
        fetch(probeUrl).then(async r => {
          const buf = await r.arrayBuffer();
          const b = new Uint8Array(buf.slice(0, 8));
          const hex = Array.from(b).map(n => n.toString(16).padStart(2, '0')).join(' ');
          console.log('[map] tile probe', probeUrl, '→ status:', r.status, 'ct:', r.headers.get('content-type'), 'size:', buf.byteLength, 'bytes:', hex);
        }).catch(e => console.error('[map] tile probe error:', e));
      }

      // Rewrite every OpenFreeMap URL that MapLibre would fetch on its own
      // (TileJSON, vector/raster tiles, glyphs, sprites) through our /ofm/ proxy.
      // This is the definitive safety net: even if fetchResolvedStyle leaves a
      // raw OFM url in the source config, transformRequest rewrites it before
      // any network request is dispatched — including requests from tile workers.
      const OFM_ORIGIN = 'https://tiles.openfreemap.org/';
      const ofmProxyBase = `${location.origin}/ofm/`;
      const transformRequest = (url: string) => {
        if (url.startsWith(OFM_ORIGIN)) {
          return { url: ofmProxyBase + url.slice(OFM_ORIGIN.length) };
        }
      };

      const map = new ml.Map({
        container: containerRef.current,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style: styleInput as any,
        center: [106.8272, -6.1751],
        zoom: 3,
        minZoom: 0,
        maxZoom: 20,
        transformRequest,
      });
      map.addControl(new ml.NavigationControl(), 'top-right');
      // Cap GeolocateControl zoom at 14 — the vector tile source's maxzoom is 14;
      // zooming beyond that causes overzoom tile-loading issues in MapLibre v6.
      map.addControl(new ml.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        fitBoundsOptions: { maxZoom: 14 },
      }), 'top-right');
      map.on('click', e => handleClick(e.lngLat.lat, e.lngLat.lng));
      map.on('style.load', () => { ensureMeasureLayer(); refreshMeasureLine(); });
      map.on('load', () => map.resize());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on('error', (e: any) => console.error('[map] error:', e?.error?.message ?? e));
      map.on('sourcedataloading', (e) => console.log('[map] source loading:', e.sourceId));
      map.on('sourcedata', (e) => { if (e.isSourceLoaded) console.log('[map] source loaded:', e.sourceId); });
      // Force a repaint after each move so MapLibre re-evaluates missing tiles.
      // We do NOT call resize() here — the canvas size doesn't change on pan/zoom,
      // and calling resize() synchronously in moveend triggers constrainInternal
      // recursion in MapLibre v6. The ResizeObserver below handles actual size changes.
      map.on('moveend', () => { map.triggerRepaint(); });
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
    let isCurrent = true;
    fetchResolvedStyle(url).then(styleInput => {
      if (isCurrent && mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mapRef.current.setStyle(styleInput as any);
      }
    });
    return () => { isCurrent = false; };
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
      // Cap at zoom 14 — the vector tile source's maxzoom; overzooming beyond that
      // causes blank tiles in MapLibre v6.
      mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 });
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
