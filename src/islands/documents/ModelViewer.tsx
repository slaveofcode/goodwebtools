import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box as BoxIcon, Camera, Download, Grid3x3, Lightbulb, Maximize, Pause, Play, X } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { CopyImageButton } from '@/components/ui/CopyImageButton';
import { ExpandableViewer } from '@/components/ui/ExpandableViewer';
import { usePrefill } from '@/hooks/usePrefill';
import { useReportable } from '@/hooks/useReportable';
import { downloadService } from '@/services/download.service';
import { MODEL_ACCEPT, SNIFF_BYTES, detectModelFormat, groupModelFiles, type ModelFormat } from '@/tools/documents/model3d-format.lib';
import { MAX_MODEL_BYTES, WARN_MODEL_BYTES, classifyFetchError, normalizeModelUrl, type FetchFailure } from '@/tools/documents/model3d-url.lib';
import type { SceneNode, SceneStats } from '@/tools/documents/model3d-scene.lib';
import type { LightMode, ModelStage } from '@/tools/documents/model3d-stage';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Open a 3D model and look around it — Blender (.blend), glTF/GLB, OBJ, STL, FBX or PLY. Everything is rendered in your browser; your model is never uploaded.',
    drop: 'Drop a 3D model or click to browse',
    dropSub: 'For glTF or OBJ, drop the model together with its .bin, .mtl and texture files',
    or: 'or open from a link',
    urlPlaceholder: 'https://example.com/model.glb',
    urlLabel: 'Model URL',
    open: 'Open',
    downloading: 'Downloading…',
    parsing: 'Reading the model…',
    big: 'Large model — this can take a while on slower devices.',
    fit: 'Fit',
    wireframe: 'Wireframe',
    grid: 'Grid',
    lights: 'Scene lights',
    screenshot: 'PNG',
    close: 'Close',
    stats: 'Stats',
    objects: 'Objects',
    format: 'Format',
    meshes: 'Meshes',
    vertices: 'Vertices',
    triangles: 'Triangles',
    materials: 'Materials',
    textures: 'Textures',
    animations: 'Animations',
    size: 'Size',
    animation: 'Animation',
    noAnimation: 'None',
    play: 'Play',
    pause: 'Pause',
    hint: 'Drag to orbit · right-drag or two fingers to pan · scroll or pinch to zoom',
    unsupported: 'This file isn’t a supported 3D model. Supported: .blend (Blender 5+), .glb, .gltf, .obj, .stl, .fbx, .ply.',
    blendOld: 'This .blend was saved in Blender {v}. Only files from Blender 5.0 or newer can be opened — re-save it in Blender 5+ or export it as .glb.',
    blendGzip: 'This .blend was saved by a Blender version older than 3.0, which isn’t supported. Re-save it in Blender 5+ or export it as .glb.',
    cors: 'Couldn’t download the model. The site hosting it must allow cross-origin downloads (CORS) — or download the file and drop it here instead.',
    notFound: 'Nothing was found at that link (404).',
    http: 'The server refused the download (HTTP {v}).',
    network: 'The download failed. Check your connection and try again.',
    badUrl: 'Enter a full https:// link to a model file.',
    tooLarge: 'This model is larger than 512 MB, which is too big to open in a browser tab.',
    parse: 'Couldn’t read this model: {v}',
    noWebgl: 'Your browser or device doesn’t support WebGL, which is needed to display 3D models.',
  },
  id: {
    intro: 'Buka model 3D dan lihat dari segala sisi — Blender (.blend), glTF/GLB, OBJ, STL, FBX, atau PLY. Semuanya dirender di browser Anda; model Anda tidak pernah diunggah.',
    drop: 'Letakkan model 3D atau klik untuk memilih',
    dropSub: 'Untuk glTF atau OBJ, letakkan model bersama berkas .bin, .mtl, dan teksturnya',
    or: 'atau buka dari tautan',
    urlPlaceholder: 'https://example.com/model.glb',
    urlLabel: 'URL model',
    open: 'Buka',
    downloading: 'Mengunduh…',
    parsing: 'Membaca model…',
    big: 'Model besar — ini bisa memakan waktu di perangkat yang lebih lambat.',
    fit: 'Pas',
    wireframe: 'Wireframe',
    grid: 'Grid',
    lights: 'Lampu adegan',
    screenshot: 'PNG',
    close: 'Tutup',
    stats: 'Statistik',
    objects: 'Objek',
    format: 'Format',
    meshes: 'Mesh',
    vertices: 'Vertex',
    triangles: 'Segitiga',
    materials: 'Material',
    textures: 'Tekstur',
    animations: 'Animasi',
    size: 'Ukuran',
    animation: 'Animasi',
    noAnimation: 'Tidak ada',
    play: 'Putar',
    pause: 'Jeda',
    hint: 'Seret untuk memutar · seret kanan atau dua jari untuk menggeser · gulir atau cubit untuk zoom',
    unsupported: 'Berkas ini bukan model 3D yang didukung. Didukung: .blend (Blender 5+), .glb, .gltf, .obj, .stl, .fbx, .ply.',
    blendOld: 'Berkas .blend ini disimpan di Blender {v}. Hanya berkas dari Blender 5.0 atau lebih baru yang bisa dibuka — simpan ulang di Blender 5+ atau ekspor sebagai .glb.',
    blendGzip: 'Berkas .blend ini disimpan oleh Blender versi lebih lama dari 3.0, yang tidak didukung. Simpan ulang di Blender 5+ atau ekspor sebagai .glb.',
    cors: 'Gagal mengunduh model. Situs yang menyimpannya harus mengizinkan unduhan lintas origin (CORS) — atau unduh berkasnya lalu letakkan di sini.',
    notFound: 'Tidak ada apa pun di tautan itu (404).',
    http: 'Server menolak unduhan (HTTP {v}).',
    network: 'Unduhan gagal. Periksa koneksi Anda lalu coba lagi.',
    badUrl: 'Masukkan tautan https:// lengkap ke berkas model.',
    tooLarge: 'Model ini lebih dari 512 MB, terlalu besar untuk dibuka di tab browser.',
    parse: 'Gagal membaca model ini: {v}',
    noWebgl: 'Browser atau perangkat Anda tidak mendukung WebGL, yang dibutuhkan untuk menampilkan model 3D.',
  },
};

const FORMAT_LABEL: Record<ModelFormat, string> = {
  blend: 'Blender', glb: 'glTF binary (GLB)', gltf: 'glTF', obj: 'OBJ', stl: 'STL', fbx: 'FBX', ply: 'PLY',
};

class FetchError extends Error {
  constructor(public kind: FetchFailure | 'too-large', public status?: number) {
    super(kind);
  }
}

interface Loaded {
  name: string;
  format: ModelFormat;
  version?: string;
  stats: SceneStats;
  tree: SceneNode[];
  clips: { name: string; duration: number }[];
  fileLights: boolean;
}

const fmt = (n: number) => n.toLocaleString();
const fmtSize = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toPrecision(2));

export default function ModelViewer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const prefill = usePrefill();

  const [urlInput, setUrlInput] = useState(prefill.url ?? '');
  const [status, setStatus] = useState<'idle' | 'downloading' | 'parsing' | 'ready'>('idle');
  const [big, setBig] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [grid, setGrid] = useState(true);
  const [lightMode, setLightMode] = useState<LightMode>('studio');
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [clip, setClip] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ now: 0, duration: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWaiter = useRef<((canvas: HTMLCanvasElement) => void) | null>(null);
  const stageRef = useRef<ModelStage | null>(null);
  const loadSeq = useRef(0);

  useReportable({ toolId: '3d-viewer', file });

  // The canvas mounts only once the viewer switches to its 'ready' layout; hand
  // it to whoever is waiting as soon as React attaches it.
  const setCanvas = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    if (el && canvasWaiter.current) {
      canvasWaiter.current(el);
      canvasWaiter.current = null;
    }
  }, []);
  const mountedCanvas = () =>
    canvasRef.current
      ? Promise.resolve(canvasRef.current)
      : new Promise<HTMLCanvasElement>(resolve => { canvasWaiter.current = resolve; });

  useEffect(() => () => {
    stageRef.current?.dispose();
    stageRef.current = null;
  }, []);

  const errorText = useCallback((e: unknown): string => {
    if (e instanceof FetchError) {
      if (e.kind === 'too-large') return t.tooLarge;
      if (e.kind === 'not-found') return t.notFound;
      if (e.kind === 'http') return t.http.replace('{v}', String(e.status ?? ''));
      return e.kind === 'cors' ? t.cors : t.network;
    }
    const err = e as { name?: string; message?: string; version?: number | null };
    if (err?.name === 'NoWebGLError') return t.noWebgl;
    if (err?.name === 'BlendVersionError') {
      return err.version == null ? t.blendGzip : t.blendOld.replace('{v}', err.version.toFixed(2));
    }
    if (err?.message === 'unsupported') return t.unsupported;
    return t.parse.replace('{v}', err?.message || String(e));
  }, [t]);

  const show = useCallback(async (src: { name: string; format: ModelFormat; buffer: ArrayBuffer; sidecars: Map<string, Blob>; baseUrl?: string }) => {
    const seq = ++loadSeq.current;
    setStatus('parsing');
    setBig(src.buffer.byteLength > WARN_MODEL_BYTES);
    // Let the status paint before synchronous parsing work starts.
    await new Promise(requestAnimationFrame);

    const [{ loadModel }, { computeSceneStats, sceneTree }, { ModelStage }] = await Promise.all([
      import('@/tools/documents/model3d-load.lib'),
      import('@/tools/documents/model3d-scene.lib'),
      import('@/tools/documents/model3d-stage'),
    ]);
    const model = await loadModel(src);
    if (seq !== loadSeq.current) return;

    setStatus('ready');
    const canvas = await mountedCanvas();
    if (seq !== loadSeq.current) return;
    if (!stageRef.current) stageRef.current = new ModelStage(canvas, canvas.parentElement!);
    const stage = stageRef.current;
    stage.onTime = (now, duration) => setTime({ now, duration });
    stage.setModel(model);
    stage.setWireframe(false);
    stage.setGrid(true);
    stage.setLightMode('studio');
    stage.selectClip(model.animations.length ? 0 : null);

    setWireframe(false);
    setGrid(true);
    setLightMode('studio');
    setHidden(new Set());
    setClip(model.animations.length ? 0 : null);
    setPlaying(false);
    setTime({ now: 0, duration: model.animations[0]?.duration ?? 0 });
    setLoaded({
      name: src.name,
      format: model.format,
      version: model.version,
      stats: computeSceneStats(model.root, model.animations),
      tree: sceneTree(model.root),
      clips: model.animations.map((a, i) => ({ name: a.name || `#${i + 1}`, duration: a.duration })),
      fileLights: stage.hasFileLights(),
    });
  }, []);

  const fail = useCallback((e: unknown) => {
    setError(errorText(e));
    setStatus(stageRef.current && loaded ? 'ready' : 'idle');
  }, [errorText, loaded]);

  const onDrop = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setError('');
    try {
      const group = await groupModelFiles(files);
      if (!group) throw new Error('unsupported');
      if (group.main.size > MAX_MODEL_BYTES) throw new FetchError('too-large');
      setFile(group.main);
      await show({ name: group.main.name, format: group.format, buffer: await group.main.arrayBuffer(), sidecars: group.sidecars });
      if (new URLSearchParams(window.location.search).has('url')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (e) {
      fail(e);
    }
  }, [show, fail]);

  const openUrl = useCallback(async (raw: string) => {
    setError('');
    const n = normalizeModelUrl(raw);
    if (!n.ok) {
      setError(t.badUrl);
      return;
    }
    setStatus('downloading');
    try {
      let res: Response;
      try {
        res = await fetch(n.url, { mode: 'cors' });
      } catch (e) {
        throw new FetchError(classifyFetchError(e));
      }
      if (!res.ok) throw new FetchError(classifyFetchError(null, res.status), res.status);
      const length = Number(res.headers.get('content-length') || 0);
      if (length > MAX_MODEL_BYTES) throw new FetchError('too-large');
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > MAX_MODEL_BYTES) throw new FetchError('too-large');

      const head = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, SNIFF_BYTES));
      const format = detectModelFormat(n.name, head, buffer.byteLength);
      if (!format) throw new Error('unsupported');
      setFile(new File([buffer], n.name));
      await show({ name: n.name, format, buffer, sidecars: new Map(), baseUrl: n.url });
      const share = new URL(window.location.href);
      share.searchParams.set('url', raw.trim());
      window.history.replaceState(null, '', share);
    } catch (e) {
      fail(e);
    }
  }, [show, fail, t]);

  // Auto-open a ?url= link once on mount.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !prefill.url) return;
    autoOpened.current = true;
    void openUrl(prefill.url);
  }, [prefill.url, openUrl]);

  const close = () => {
    loadSeq.current++;
    stageRef.current?.dispose();
    stageRef.current = null;
    setLoaded(null);
    setFile(null);
    setStatus('idle');
    setError('');
  };

  const snapshot = useCallback(() => {
    if (!stageRef.current) return Promise.reject(new Error('No model'));
    return stageRef.current.snapshot();
  }, []);

  const downloadPng = async () => {
    const blob = await snapshot();
    const base = (loaded?.name ?? 'model').replace(/\.[^.]+$/, '');
    await downloadService.download(blob, `${base}.png`);
  };

  const toggleHidden = (uuid: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      const nowHidden = !next.has(uuid);
      if (nowHidden) next.add(uuid); else next.delete(uuid);
      stageRef.current?.setVisible(uuid, !nowHidden);
      return next;
    });
  };

  const statRows = useMemo(() => {
    if (!loaded) return [];
    const s = loaded.stats;
    return [
      [t.format, loaded.version ? `${FORMAT_LABEL[loaded.format]} · ${loaded.version}` : FORMAT_LABEL[loaded.format]],
      [t.objects, fmt(s.objects)],
      [t.meshes, fmt(s.meshes)],
      [t.vertices, fmt(s.vertices)],
      [t.triangles, fmt(s.triangles)],
      [t.materials, fmt(s.materials)],
      [t.textures, fmt(s.textures)],
      [t.animations, fmt(s.animations)],
      [t.size, s.size.map(fmtSize).join(' × ')],
    ];
  }, [loaded, t]);

  const busy = status === 'downloading' || status === 'parsing';
  const showStage = status === 'ready' || (busy && !!loaded);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {!showStage && (
        <div className="space-y-3">
          <Dropzone onDrop={onDrop} accept={MODEL_ACCEPT} multiple>
            <div className="space-y-1">
              <p className="font-bold">{t.drop}</p>
              <p className="text-sm text-muted-foreground">{t.dropSub}</p>
            </div>
          </Dropzone>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={e => { e.preventDefault(); void openUrl(urlInput); }}
          >
            <label className="sr-only" htmlFor="model-url">{t.urlLabel}</label>
            <input
              id="model-url"
              type="url"
              inputMode="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder={t.urlPlaceholder}
              aria-label={t.urlLabel}
              className="min-w-0 flex-1 border-2 border-border bg-muted p-2 text-sm"
            />
            <Button type="submit" variant="secondary" disabled={busy}>{t.open}</Button>
          </form>
          <p className="text-xs text-muted-foreground">{t.or}: .blend · .glb · .gltf · .obj · .stl · .fbx · .ply</p>
        </div>
      )}

      {busy && (
        <p role="status" className="text-sm font-bold">
          {status === 'downloading' ? t.downloading : t.parsing}
          {big && <span className="block font-normal text-muted-foreground">{t.big}</span>}
        </p>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {showStage && (
        <ExpandableViewer lang={lang}>
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap gap-2" role="toolbar">
                <Button variant="secondary" onClick={() => stageRef.current?.fit()}>
                  <Maximize className="h-4 w-4" />{t.fit}
                </Button>
                <Button
                  variant={wireframe ? 'primary' : 'secondary'}
                  aria-pressed={wireframe}
                  onClick={() => { const v = !wireframe; setWireframe(v); stageRef.current?.setWireframe(v); }}
                >
                  <BoxIcon className="h-4 w-4" />{t.wireframe}
                </Button>
                <Button
                  variant={grid ? 'primary' : 'secondary'}
                  aria-pressed={grid}
                  onClick={() => { const v = !grid; setGrid(v); stageRef.current?.setGrid(v); }}
                >
                  <Grid3x3 className="h-4 w-4" />{t.grid}
                </Button>
                {loaded?.fileLights && (
                  <Button
                    variant={lightMode === 'file' ? 'primary' : 'secondary'}
                    aria-pressed={lightMode === 'file'}
                    onClick={() => {
                      const v: LightMode = lightMode === 'file' ? 'studio' : 'file';
                      setLightMode(v);
                      stageRef.current?.setLightMode(v);
                    }}
                  >
                    <Lightbulb className="h-4 w-4" />{t.lights}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => void downloadPng()} aria-label={`${t.screenshot} ↓`}>
                  <Camera className="h-4 w-4" /><Download className="h-4 w-4" />{t.screenshot}
                </Button>
                <CopyImageButton blob={snapshot} />
                <Button variant="ghost" onClick={close}>
                  <X className="h-4 w-4" />{t.close}
                </Button>
              </div>

              <div className="relative aspect-[4/3] w-full border-2 border-border bg-neutral-800 md:aspect-video">
                <canvas ref={setCanvas} data-testid="model-canvas" className="absolute inset-0 h-full w-full touch-none" />
              </div>
              <p className="text-xs text-muted-foreground">{t.hint}</p>

              {loaded && loaded.clips.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-2 border-border p-2">
                  <label className="text-sm font-bold" htmlFor="model-clip">{t.animation}</label>
                  <select
                    id="model-clip"
                    value={clip ?? ''}
                    onChange={e => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      setClip(v);
                      setPlaying(false);
                      stageRef.current?.selectClip(v);
                      setTime({ now: 0, duration: v === null ? 0 : loaded.clips[v]?.duration ?? 0 });
                    }}
                    className="border-2 border-border bg-muted p-1 text-sm"
                  >
                    <option value="">{t.noAnimation}</option>
                    {loaded.clips.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
                  </select>
                  <Button
                    variant="secondary"
                    disabled={clip === null}
                    onClick={() => { const v = !playing; setPlaying(v); stageRef.current?.setPlaying(v); }}
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {playing ? t.pause : t.play}
                  </Button>
                  <input
                    type="range"
                    aria-label={t.animation}
                    min={0}
                    max={time.duration || 0}
                    step={0.01}
                    value={Math.min(time.now, time.duration)}
                    disabled={clip === null}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setTime(prev => ({ ...prev, now: v }));
                      stageRef.current?.seek(v);
                    }}
                    className="min-w-[8rem] flex-1"
                  />
                  <span className="text-xs tabular-nums">{time.now.toFixed(2)} / {time.duration.toFixed(2)} s</span>
                </div>
              )}
            </div>

            {loaded && (
              <aside className="space-y-3 md:w-72">
                <section className="border-2 border-border p-3">
                  <h2 className="mb-2 text-sm font-bold uppercase">{t.stats}</h2>
                  <p className="mb-2 break-all text-sm">{loaded.name}</p>
                  <dl data-testid="model-stats" className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
                    {statRows.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="text-right tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <section className="border-2 border-border p-3">
                  <h2 className="mb-2 text-sm font-bold uppercase">{t.objects}</h2>
                  <ul className="max-h-80 space-y-1 overflow-auto text-sm">
                    <TreeNodes nodes={loaded.tree} hidden={hidden} onToggle={toggleHidden} />
                  </ul>
                </section>
              </aside>
            )}
          </div>
        </ExpandableViewer>
      )}
    </div>
  );
}

function TreeNodes({ nodes, hidden, onToggle }: { nodes: SceneNode[]; hidden: Set<string>; onToggle: (uuid: string) => void }) {
  return (
    <>
      {nodes.map(n => (
        <li key={n.uuid}>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!hidden.has(n.uuid)} onChange={() => onToggle(n.uuid)} aria-label={n.name} />
            <span className="truncate">{n.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{n.type}</span>
          </label>
          {n.children.length > 0 && (
            <ul className="ml-4 mt-1 space-y-1 border-l-2 border-border pl-2">
              <TreeNodes nodes={n.children} hidden={hidden} onToggle={onToggle} />
            </ul>
          )}
        </li>
      ))}
    </>
  );
}
