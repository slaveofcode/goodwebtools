import { useEffect, useRef, useState, type ComponentType } from 'react';

// Builds a fingerprint that distinguishes scenes even when getSceneVersion
// returns the same sum for two different element sets (e.g. two separate
// one-element drawings each at version 1).  Combines version sum + element
// IDs + file IDs so any real scene change is reliably detected.
function computeSceneKey(
  elements: readonly unknown[],
  files: Record<string, unknown> | undefined,
  getVersion: (els: readonly unknown[]) => number,
): string {
  const ver = getVersion(elements);
  const ids = (elements as { id?: string }[]).map(e => e.id ?? '').join('\0');
  const fk = Object.keys(files ?? {}).sort().join('\0');
  return `${ver}|${ids}|${fk}`;
}
import { Maximize2, Minimize2, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { loadScene, saveScene, shouldAutosave, type WhiteboardScene } from '@/tools/draw/whiteboard.store';
import type { Lang } from '@/i18n/config';
import '@excalidraw/excalidraw/index.css';

// How often the autosave poll runs. Saving itself is debounced (~0.8s idle) with
// a hard cap (~5s) inside shouldAutosave, so drawings persist promptly.
const POLL_MS = 400;

const TR: Record<Lang, {
  saveNow: string;
  unsaved: string;
  saving: string;
  saved: string;
  saveFailed: string;
  loadError: string;
  loading: string;
  descPre: string;
  descMid: string;
  descPost: string;
  expand: string;
  showNavbar: string;
  hideNavbarSpace: string;
  hideNavbar: string;
  exit: string;
}> = {
  en: {
    saveNow: 'Save now',
    unsaved: 'Unsaved · save now',
    saving: 'Saving…',
    saved: 'Saved',
    saveFailed: 'Save failed — export a backup',
    loadError: "Couldn't load the whiteboard. Please refresh the page.",
    loading: 'Loading whiteboard…',
    descPre: 'A full whiteboard for sketches, diagrams, flowcharts, and mind maps. Everything stays in your browser — export as PNG/SVG or a reusable ',
    descMid: ' file from the menu. Powered by ',
    descPost: ' — you can also use it at excalidraw.com.',
    expand: 'Expand',
    showNavbar: 'Show navbar',
    hideNavbarSpace: 'Hide navbar for more space',
    hideNavbar: 'Hide navbar',
    exit: 'Exit',
  },
  id: {
    saveNow: 'Simpan sekarang',
    unsaved: 'Belum tersimpan · simpan sekarang',
    saving: 'Menyimpan…',
    saved: 'Tersimpan',
    saveFailed: 'Gagal menyimpan — ekspor cadangan',
    loadError: 'Tidak dapat memuat whiteboard. Silakan muat ulang halaman.',
    loading: 'Memuat whiteboard…',
    descPre: 'Whiteboard lengkap untuk sketsa, diagram, flowchart, dan mind map. Semuanya tetap di browser Anda — ekspor sebagai PNG/SVG atau file ',
    descMid: ' yang dapat digunakan ulang dari menu. Didukung oleh ',
    descPost: ' — Anda juga dapat menggunakannya di excalidraw.com.',
    expand: 'Perbesar',
    showNavbar: 'Tampilkan navbar',
    hideNavbarSpace: 'Sembunyikan navbar untuk ruang lebih',
    hideNavbar: 'Sembunyikan navbar',
    exit: 'Keluar',
  },
};

// Serve Excalidraw's fonts from our own origin (copied to public/excalidraw)
// instead of its default esm.sh CDN — keeps the zero-external-request promise.
if (typeof window !== 'undefined') {
  (window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/';
}

export default function Whiteboard({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  // Excalidraw is a large, browser-only React component — load it after mount
  // so it never runs during SSR.
  const [Excalidraw, setExcalidraw] = useState<ComponentType<Record<string, unknown>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Pin the expanded overlay's top to the sticky header's actual bottom so there
  // is never a gap, regardless of the header's rendered height.
  const [navBottom, setNavBottom] = useState(67);
  // Save status shown in the header. 'unsaved' → buffered edits pending a save,
  // 'saving' → a write is in flight, 'saved' → persisted.
  const [saveState, setSaveState] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');

  // Optionally hide the navbar (only while expanded) for maximum canvas space.
  const [navHidden, setNavHidden] = useState(false);

  // Remember whether the board was expanded / navbar hidden, so they persist.
  const setExpandedPersist = (v: boolean) => {
    setExpanded(v);
    try { localStorage.setItem('gwt-whiteboard-expanded', v ? '1' : '0'); } catch { /* ignore */ }
  };
  const setNavHiddenPersist = (v: boolean) => {
    setNavHidden(v);
    try { localStorage.setItem('gwt-whiteboard-navhidden', v ? '1' : '0'); } catch { /* ignore */ }
  };
  useEffect(() => {
    if (localStorage.getItem('gwt-whiteboard-expanded') === '1') setExpanded(true);
    if (localStorage.getItem('gwt-whiteboard-navhidden') === '1') setNavHidden(true);
  }, []);

  // Restore the last scene (client-only). Excalidraw accepts a Promise for
  // initialData, so this loads the persisted drawing before it renders.
  const initialDataRef = useRef<ReturnType<typeof loadScene> | undefined>(undefined);
  if (typeof window !== 'undefined' && initialDataRef.current === undefined) {
    initialDataRef.current = loadScene();
  }
  // Changes are buffered and flushed shortly after the user pauses (debounced),
  // rather than on every onChange, so saving isn't constant. A short warm-up
  // ignores Excalidraw's own init onChange so we don't save with no real edits.
  const latestScene = useRef<WhiteboardScene | null>(null);
  const dirty = useRef(false);
  const ready = useRef(false);
  const sceneVersionOf = useRef<(els: readonly unknown[]) => number>(() => 0);
  const savedKey = useRef<string | null>(null);
  // Timestamps that drive the debounce: when the last change happened, and when
  // the scene first became dirty since the last save.
  const lastChangeAt = useRef(0);
  const dirtySince = useRef(0);
  const saving = useRef(false);

  // Persist the buffered scene now. Async and idempotent — safe to call from the
  // poll, the "save now" button, or on tab hide. Not called from a render/updater.
  const flushSave = async () => {
    if (!latestScene.current || !dirty.current || saving.current) return;
    saving.current = true;
    dirty.current = false;
    const scene = latestScene.current;
    const key = computeSceneKey(scene.elements, scene.files, sceneVersionOf.current);
    setSaveState('saving');
    const ok = await saveScene(scene);
    saving.current = false;
    if (!ok) {
      // The write failed — re-mark dirty so it retries, and show it honestly
      // rather than a false "Saved". Do NOT advance savedKey, or the change
      // would look already-saved and never retry.
      dirty.current = true;
      setSaveState('error');
      return;
    }
    savedKey.current = key;
    // A change may have arrived during the write; only show "Saved" if still clean.
    setSaveState(dirty.current ? 'unsaved' : 'saved');
  };

  const onChange = (
    elements: readonly unknown[],
    appState: Record<string, unknown>,
    files: Record<string, unknown>,
  ) => {
    latestScene.current = {
      elements,
      appState: { viewBackgroundColor: appState?.viewBackgroundColor },
      files,
    };
    const key = computeSceneKey(elements, files, sceneVersionOf.current);
    // Baseline on the first change (restored scene) and during warm-up.
    if (savedKey.current === null || !ready.current) { savedKey.current = key; return; }
    // Only a genuine element or file change marks the scene dirty.
    if (key !== savedKey.current) {
      lastChangeAt.current = Date.now();
      if (!dirty.current) {
        dirty.current = true;
        dirtySince.current = lastChangeAt.current;
        setSaveState('unsaved');
      }
    }
  };

  useEffect(() => {
    // Warm-up so the initial (non-user) onChange isn't treated as an edit.
    const warm = setTimeout(() => { ready.current = true; }, 1500);
    // Poll frequently; shouldAutosave debounces (~0.8s idle) with a ~5s hard cap
    // so drawings persist promptly while the page is open.
    const tick = setInterval(() => {
      if (!dirty.current) return;
      const now = Date.now();
      if (shouldAutosave({ dirty: true, idleMs: now - lastChangeAt.current, dirtyForMs: now - dirtySince.current })) {
        void flushSave();
      }
    }, POLL_MS);
    // Save immediately when the tab is hidden/closed so the last edits aren't lost.
    const onHide = () => { if (document.visibilityState === 'hidden') void flushSave(); };
    // Warn before leaving with buffered (not-yet-saved) changes. The browser only
    // allows its own native confirmation here — a custom modal can't block a close.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) { e.preventDefault(); e.returnValue = ''; }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushSave);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      clearTimeout(warm);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushSave);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    import('@excalidraw/excalidraw')
      .then(m => {
        if (!alive) return;
        // getSceneVersion changes only on real element edits, not on cursor /
        // selection / hover onChange noise — so we can tell "actually changed".
        sceneVersionOf.current = m.getSceneVersion as (els: readonly unknown[]) => number;
        // Rebase savedKey now that we have the real getSceneVersion — the
        // default () => 0 would produce a stale key that mismatches on the
        // next onChange even when nothing actually changed.
        if (latestScene.current) {
          savedKey.current = computeSceneKey(
            latestScene.current.elements,
            latestScene.current.files,
            sceneVersionOf.current,
          );
        }
        setExcalidraw(() => m.Excalidraw);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  // Esc collapses the expanded view (Excalidraw handles Esc for its own
  // selection first, so this only fires when nothing intercepts it).
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedPersist(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // While expanded, hide the sticky navbar if the user chose to (for max space),
  // otherwise measure its bottom edge so the overlay butts right up to it.
  useEffect(() => {
    const header = document.querySelector('header') as HTMLElement | null;
    if (!header) return;
    header.style.display = expanded && navHidden ? 'none' : '';
    if (!expanded || navHidden) return () => { header.style.display = ''; };
    const measure = () => setNavBottom(Math.round(header.getBoundingClientRect().bottom || 0));
    measure();
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); header.style.display = ''; };
  }, [expanded, navHidden]);

  const statusIndicator = saveState === 'error' ? (
    <button
      onClick={() => { dirty.current = true; void flushSave(); }}
      title={t.saveNow}
      className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-600 underline underline-offset-2 hover:text-red-700 dark:text-red-400"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
      {t.saveFailed}
    </button>
  ) : saveState === 'unsaved' ? (
    <button
      onClick={() => void flushSave()}
      title={t.saveNow}
      className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-600 underline underline-offset-2 hover:text-amber-700"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
      {t.unsaved}
    </button>
  ) : (
    <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
      {saveState === 'saving'
        ? <><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-muted-foreground" /> {t.saving}</>
        : <><Check className="h-3.5 w-3.5" /> {t.saved}</>}
    </span>
  );

  const canvas = failed ? (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {t.loadError}
    </div>
  ) : Excalidraw ? (
    <Excalidraw initialData={initialDataRef.current} onChange={onChange} />
  ) : (
    <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
      {t.loading}
    </div>
  );

  // Where the expanded overlay starts: below the navbar, or 0 when it's hidden.
  const topOffset = navHidden ? 0 : navBottom;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t.descPre}<code>.excalidraw</code>{t.descMid}
          <a
            href="https://excalidraw.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-foreground underline underline-offset-2 hover:text-accent"
          >
            Excalidraw
          </a>
          {t.descPost}
        </p>
        <div className="flex items-center gap-3">
          {statusIndicator}
          {!expanded && (
            <Button variant="secondary" onClick={() => setExpandedPersist(true)}>
              <Maximize2 className="h-4 w-4" />
              {t.expand}
            </Button>
          )}
        </div>
      </div>

      {/* Same wrapper element in both states so Excalidraw is never remounted
          (the drawing is preserved). Expanded = a fixed overlay that fills the
          viewport below the sticky navbar (which stays visible at top). */}
      <div
        className={
          expanded
            ? 'fixed inset-x-0 bottom-0 z-30 !mt-0 overflow-hidden border-t-2 border-border bg-background'
            : 'h-[75vh] w-full overflow-hidden border-2 border-border'
        }
        style={expanded ? { top: topOffset } : undefined}
      >
        {canvas}
      </div>

      {/* Pull-tab centered at the navbar edge: hide the navbar for more canvas,
          or bring it back. Only relevant while expanded. */}
      {expanded && (
        <button
          onClick={() => setNavHiddenPersist(!navHidden)}
          title={navHidden ? t.showNavbar : t.hideNavbarSpace}
          aria-label={navHidden ? t.showNavbar : t.hideNavbar}
          className={`fixed left-1/2 z-50 !mt-0 -translate-x-1/2 rounded-b-md border-2 border-t-0 border-border bg-background px-5 py-0.5 shadow-brutal-sm hover:bg-muted ${navHidden ? '' : '-translate-y-full'}`}
          style={{ top: topOffset }}
        >
          {navHidden ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      )}

      {expanded && (
        <div className="fixed right-4 z-40 !mt-0 flex items-center gap-3" style={{ top: topOffset + 8 }}>
          <div className="border-2 border-border bg-background px-2 py-1.5 shadow-brutal-sm">
            {statusIndicator}
          </div>
          <Button variant="secondary" onClick={() => setExpandedPersist(false)} className="shadow-brutal">
            <Minimize2 className="h-4 w-4" />
            {t.exit}
          </Button>
        </div>
      )}
    </div>
  );
}
