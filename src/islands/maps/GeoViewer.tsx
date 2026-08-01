import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { themeAtom } from '@/stores/theme.store';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { resolveStyle, MAP_STYLES, type StyleChoice } from '@/tools/geo/map-styles.lib';
import { parseGeoFile, computeBbox } from '@/tools/geo/geo-parse.lib';

const STYLE_KEY = 'gwt.map.style';
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

export default function GeoViewer() {
  const theme = useStore(themeAtom);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const mlRef = useRef<typeof import('maplibre-gl') | null>(null);
  const fcRef = useRef<FeatureCollection>(EMPTY);
  const roRef = useRef<ResizeObserver | null>(null);

  const [style, setStyle] = useState<StyleChoice>('auto');
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  useEffect(() => { try { const s = localStorage.getItem(STYLE_KEY) as StyleChoice | null; if (s) setStyle(s); } catch { /* */ } }, []);

  const renderGeo = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const existing = map.getSource('geo') as GeoJSONSource | undefined;
    if (existing) { existing.setData(fcRef.current); return; }
    map.addSource('geo', { type: 'geojson', data: fcRef.current });
    map.addLayer({ id: 'geo-fill', type: 'fill', source: 'geo', paint: { 'fill-color': '#7c3aed', 'fill-opacity': 0.2 } });
    map.addLayer({ id: 'geo-line', type: 'line', source: 'geo', paint: { 'line-color': '#7c3aed', 'line-width': 2.5 } });
    map.addLayer({ id: 'geo-point', type: 'circle', source: 'geo', paint: { 'circle-radius': 5, 'circle-color': '#dc2626', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
  };

  const fit = () => {
    const bbox = computeBbox(fcRef.current);
    if (bbox && mapRef.current) mapRef.current.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, maxZoom: 16, duration: 600 });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ml = await import('maplibre-gl');
      if (cancelled || !containerRef.current || mapRef.current) return;
      mlRef.current = ml;
      const map = new ml.Map({ container: containerRef.current, style: resolveStyle(style, theme).url, center: [0, 20], zoom: 1.3 });
      map.addControl(new ml.NavigationControl(), 'top-right');
      map.on('style.load', () => { renderGeo(); });
      map.on('click', e => {
        const feats = map.queryRenderedFeatures(e.point, { layers: ['geo-fill', 'geo-line', 'geo-point'] });
        setSelected(feats[0]?.properties ?? null);
      });
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

  const onDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError('');
    setSelected(null);
    try {
      const fc = await parseGeoFile(await file.text(), file.name);
      if (!fc || fc.features.length === 0) { setError('No map features found in this file (expected GeoJSON, GPX or KML).'); return; }
      fcRef.current = fc;
      setCount(fc.features.length);
      renderGeo();
      fit();
    } catch {
      setError('Could not read this file.');
    }
  };

  return (
    <div className="space-y-3">
      <Dropzone onDrop={onDrop} accept=".geojson,.json,.gpx,.kml,application/geo+json,application/gpx+xml,application/vnd.google-earth.kml+xml" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop a GeoJSON, GPX or KML file</p>
          <p className="text-sm text-muted-foreground">View tracks &amp; features on a map · the file stays on your device</p>
        </div>
      </Dropzone>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Style</span>
        {MAP_STYLES.map(s => (
          <Button key={s.id} variant={style === s.id ? 'primary' : 'secondary'} aria-pressed={style === s.id} onClick={() => pickStyle(s.id)}>{s.label}</Button>
        ))}
        {count > 0 && <Button variant="ghost" onClick={fit}>Fit to data</Button>}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div ref={containerRef} className="h-[60vh] w-full border-2 border-border" />

      <p className="text-xs text-muted-foreground">
        {count > 0 ? `${count} feature${count === 1 ? '' : 's'} · click one to see its properties. ` : ''}
        Maps © OpenFreeMap / OpenStreetMap contributors.
      </p>

      {selected && (
        <div className="space-y-1 border-2 border-border p-3">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Feature properties</p>
          {Object.keys(selected).length === 0 && <p className="text-sm text-muted-foreground">(no properties)</p>}
          {Object.entries(selected).map(([k, v]) => (
            <div key={k} className="flex flex-wrap gap-2 text-sm">
              <span className="font-bold">{k}</span>
              <span className="min-w-0 break-all text-muted-foreground">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
