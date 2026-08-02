import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Maximize2, Minimize2, ChevronUp, ChevronDown, Save, FolderOpen, Check } from 'lucide-react';
import { parseDbml, buildFlow } from '@/tools/draw/dbml.lib';
import { layoutNodes } from '@/tools/draw/layout.lib';
import { loadDoc, saveDoc, type DbDiagramDoc } from '@/tools/draw/dbdiagram.store';
import TableNode from './db-diagram/TableNode';
import RelationEdge from './db-diagram/RelationEdge';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ImageResult } from '@/components/ui/ImageResult';
import { downloadService } from '@/services/download';
import { exportSql, DIALECTS, type Dialect } from '@/tools/draw/sql-export.lib';
import { exportDiagramImage, type ImageFormat } from '@/tools/draw/diagram-image.lib';
import { addRef, removeRef, type RefColumn } from '@/tools/draw/refs.lib';
import type { Lang } from '@/i18n/config';
import '@xyflow/react/dist/style.css';

const TR: Record<Lang, {
  loading: string;
  descPre: string;
  descPost: string;
  saveProject: string;
  exportDbml: string;
  open: string;
  saving: string;
  saved: string;
  sqlDialect: string;
  exportSql: string;
  image: string;
  scale: string;
  exportImage: string;
  expand: string;
  showNavbar: string;
  hideNavbarSpace: string;
  hideNavbar: string;
  exit: string;
  copySql: string;
  downloadSql: string;
  exportFailed: string;
}> = {
  en: {
    loading: 'Loading diagram…',
    descPre: 'Write your schema in ',
    descPost: ' on the left; the ER diagram updates live. Drag tables to arrange them — your layout and schema are saved in your browser.',
    saveProject: 'Save project',
    exportDbml: 'Export .dbml',
    open: 'Open…',
    saving: 'Saving…',
    saved: 'Saved',
    sqlDialect: 'SQL dialect',
    exportSql: 'Export SQL',
    image: 'Image',
    scale: 'Scale',
    exportImage: 'Export image',
    expand: 'Expand',
    showNavbar: 'Show navbar',
    hideNavbarSpace: 'Hide navbar for more space',
    hideNavbar: 'Hide navbar',
    exit: 'Exit',
    copySql: 'Copy SQL',
    downloadSql: 'Download .sql',
    exportFailed: 'Export failed',
  },
  id: {
    loading: 'Memuat diagram…',
    descPre: 'Tulis skema Anda dalam ',
    descPost: ' di sebelah kiri; diagram ER diperbarui secara langsung. Seret tabel untuk menatanya — tata letak dan skema Anda disimpan di browser Anda.',
    saveProject: 'Simpan proyek',
    exportDbml: 'Ekspor .dbml',
    open: 'Buka…',
    saving: 'Menyimpan…',
    saved: 'Tersimpan',
    sqlDialect: 'Dialek SQL',
    exportSql: 'Ekspor SQL',
    image: 'Gambar',
    scale: 'Skala',
    exportImage: 'Ekspor gambar',
    expand: 'Perbesar',
    showNavbar: 'Tampilkan navbar',
    hideNavbarSpace: 'Sembunyikan navbar untuk ruang lebih',
    hideNavbar: 'Sembunyikan navbar',
    exit: 'Keluar',
    copySql: 'Salin SQL',
    downloadSql: 'Unduh .sql',
    exportFailed: 'Ekspor gagal',
  },
};

const SEED = `Table users {
  id int [pk, increment]
  email varchar [not null, unique]
  created_at timestamp
}

Table posts {
  id int [pk, increment]
  user_id int [not null]
  title varchar
  body text
}

Ref: posts.user_id > users.id
`;

const nodeTypes = { table: TableNode };
const edgeTypes = { relation: RelationEdge };

export default function DbDiagram({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  // react-flow is browser-only and heavy — load it after mount (like Whiteboard).
  const [RF, setRF] = useState<{
    ReactFlow: ComponentType<Record<string, unknown>>;
    Background: ComponentType<Record<string, unknown>>;
    Controls: ComponentType<Record<string, unknown>>;
    MiniMap: ComponentType<Record<string, unknown>>;
    applyNodeChanges: (changes: unknown[], nodes: unknown[]) => unknown[];
    applyEdgeChanges: (changes: unknown[], edges: unknown[]) => unknown[];
  } | null>(null);

  const [dbml, setDbml] = useState(SEED);
  const [nodes, setNodes] = useState<Record<string, unknown>[]>([]);
  const [edges, setEdges] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dialect, setDialect] = useState<Dialect>('postgres');
  const [sql, setSql] = useState<string | null>(null);
  const [sqlErr, setSqlErr] = useState<string | null>(null);
  const [imgFormat, setImgFormat] = useState<ImageFormat>('png');
  const [imgScale, setImgScale] = useState(2);
  const [imgBlob, setImgBlob] = useState<Blob | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const flowWrapper = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [navBottom, setNavBottom] = useState(67);
  const positions = useRef<Record<string, { x: number; y: number }>>({});
  const loaded = useRef(false);

  const setExpandedPersist = (v: boolean) => { setExpanded(v); try { localStorage.setItem('gwt-dbdiagram-expanded', v ? '1' : '0'); } catch { /* ignore */ } };
  const setNavHiddenPersist = (v: boolean) => { setNavHidden(v); try { localStorage.setItem('gwt-dbdiagram-navhidden', v ? '1' : '0'); } catch { /* ignore */ } };

  useEffect(() => {
    if (localStorage.getItem('gwt-dbdiagram-expanded') === '1') setExpanded(true);
    if (localStorage.getItem('gwt-dbdiagram-navhidden') === '1') setNavHidden(true);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedPersist(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

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

  const topOffset = navHidden ? 0 : navBottom;

  useEffect(() => {
    let alive = true;
    import('@xyflow/react').then((m) => {
      if (!alive) return;
      setRF({
        ReactFlow: m.ReactFlow as unknown as ComponentType<Record<string, unknown>>,
        Background: m.Background as unknown as ComponentType<Record<string, unknown>>,
        Controls: m.Controls as unknown as ComponentType<Record<string, unknown>>,
        MiniMap: m.MiniMap as unknown as ComponentType<Record<string, unknown>>,
        applyNodeChanges: m.applyNodeChanges as unknown as (c: unknown[], n: unknown[]) => unknown[],
        applyEdgeChanges: m.applyEdgeChanges as unknown as (c: unknown[], e: unknown[]) => unknown[],
      });
    });
    return () => { alive = false; };
  }, []);

  // Load persisted doc once.
  useEffect(() => {
    loadDoc().then((doc) => {
      if (doc) {
        positions.current = doc.positions ?? {};
        setDbml(doc.dbml || SEED);
      }
      loaded.current = true;
    });
  }, []);

  // Re-parse + re-render whenever DBML changes (debounced). Keep the last good
  // diagram on parse errors so the user doesn't lose context mid-typo.
  useEffect(() => {
    const t = setTimeout(() => {
      const { db, error: err } = parseDbml(dbml);
      setError(err);
      if (err) return; // keep previous nodes/edges
      const flow = buildFlow(db);
      // deletable:false so pressing Delete on a selected table doesn't remove it
      // (only relationship edges are deletable on the canvas).
      const positioned = layoutNodes(flow.nodes, flow.edges, positions.current).map((n) => ({ ...n, deletable: false }));
      setNodes(positioned as unknown as Record<string, unknown>[]);
      setEdges(flow.edges.map((e) => ({ ...e, type: 'relation' })) as unknown as Record<string, unknown>[]);
    }, 400);
    return () => clearTimeout(t);
  }, [dbml]);

  // Debounced autosave of DBML + positions, with a visible status indicator.
  useEffect(() => {
    if (!loaded.current) return;
    setSaveState('saving');
    const t = setTimeout(() => {
      void saveDoc({ dbml, positions: positions.current, updatedAt: Date.now() } satisfies DbDiagramDoc).then(() =>
        setSaveState('saved'),
      );
    }, 800);
    return () => clearTimeout(t);
  }, [dbml, nodes]);

  const onNodesChange = useCallback(
    (changes: unknown[]) => {
      if (!RF) return;
      setNodes((ns) => {
        const next = RF.applyNodeChanges(changes, ns) as { id: string; position: { x: number; y: number } }[];
        // Record dragged positions so re-parses preserve them.
        for (const n of next) positions.current[n.id] = n.position;
        return next as unknown as Record<string, unknown>[];
      });
    },
    [RF],
  );

  // Save the full scene (DBML + layout) to a project file, Excalidraw-style.
  const saveProject = () => {
    const doc = { dbml, positions: positions.current, updatedAt: Date.now() } satisfies DbDiagramDoc;
    downloadService.download(
      new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
      'schema.dbdiagram.json',
    );
  };

  // Export just the schema as a portable .dbml text file.
  const exportDbmlFile = () => {
    downloadService.download(new Blob([dbml], { type: 'text/plain' }), 'schema.dbml');
  };

  // Open a .dbdiagram.json project (restores layout) or a raw .dbml (auto-layout).
  const openFile = async (file: File) => {
    const text = await file.text();
    const looksJson = file.name.toLowerCase().endsWith('.json') || /^\s*\{/.test(text);
    if (looksJson) {
      try {
        const doc = JSON.parse(text) as Partial<DbDiagramDoc>;
        if (typeof doc.dbml === 'string') {
          positions.current = doc.positions ?? {};
          setDbml(doc.dbml);
          return;
        }
      } catch {
        /* not valid JSON — fall through and treat the whole file as DBML */
      }
    }
    positions.current = {}; // raw schema → re-layout from scratch
    setDbml(text);
  };

  const runSqlExport = () => {
    setSqlErr(null);
    setSql(null);
    try {
      setSql(exportSql(dbml, dialect));
    } catch (e) {
      setSqlErr(e instanceof Error ? e.message : t.exportFailed);
    }
  };

  const runImageExport = async () => {
    // Export the whole diagram: html-to-image captures the react-flow viewport DOM.
    const el = flowWrapper.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
    const target = el ?? flowWrapper.current;
    if (!target) return;
    setImgBlob(await exportDiagramImage(target, { format: imgFormat, scale: imgScale }));
  };

  // Apply edge changes (selection, removal) — required for controlled edges,
  // otherwise clicking a relationship can't select it.
  const onEdgesChange = useCallback(
    (changes: unknown[]) => {
      if (!RF) return;
      setEdges((es) => RF.applyEdgeChanges(changes, es) as unknown as Record<string, unknown>[]);
    },
    [RF],
  );

  // Look up a column's key flags from the current diagram nodes.
  const columnInfo = useCallback(
    (table: string, column: string): RefColumn | null => {
      const node = (nodes as { id: string; data: { columns: { name: string; pk?: boolean; unique?: boolean }[] } }[]).find((n) => n.id === table);
      const col = node?.data?.columns?.find((c) => c.name === column);
      if (!col) return null;
      return { table, column, pk: !!col.pk, unique: !!col.unique };
    },
    [nodes],
  );

  // Drag column→column to add a relationship (writes a Ref line into the DBML).
  const onConnect = useCallback(
    (c: { source: string | null; sourceHandle: string | null; target: string | null; targetHandle: string | null }) => {
      if (!c.source || !c.target || !c.sourceHandle || !c.targetHandle) return;
      const from = columnInfo(c.source, c.sourceHandle);
      const to = columnInfo(c.target, c.targetHandle);
      if (!from || !to) return;
      setDbml((prev) => addRef(prev, from, to));
    },
    [columnInfo],
  );

  // Delete a selected relationship (removes its Ref line from the DBML).
  const onEdgesDelete = useCallback(
    (deleted: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }[]) => {
      setDbml((prev) =>
        deleted.reduce((acc, e) => {
          if (!e.sourceHandle || !e.targetHandle) return acc;
          return removeRef(acc, { table: e.source, column: e.sourceHandle }, { table: e.target, column: e.targetHandle });
        }, prev),
      );
    },
    [],
  );

  const onNodeMouseEnter = useCallback((_e: unknown, node: { id: string }) => setHoveredId(node.id), []);
  const onNodeMouseLeave = useCallback(() => setHoveredId(null), []);

  const diagram = useMemo(() => {
    if (!RF) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t.loading}</div>;
    const { ReactFlow, Background, Controls, MiniMap } = RF;

    // Derive hover emphasis: connected edges + neighbour tables pop; the rest dim.
    const connEdges = hoveredId
      ? (edges as { id: string; source: string; target: string; sourceHandle: string; targetHandle: string }[]).filter(
          (e) => e.source === hoveredId || e.target === hoveredId,
        )
      : [];
    const neighbours = new Set<string>();
    const hotByTable: Record<string, Set<string>> = {};
    for (const e of connEdges) {
      neighbours.add(e.source);
      neighbours.add(e.target);
      (hotByTable[e.source] ??= new Set()).add(e.sourceHandle);
      (hotByTable[e.target] ??= new Set()).add(e.targetHandle);
    }
    const connIds = new Set(connEdges.map((e) => e.id));

    const dispNodes = (nodes as { id: string; data: Record<string, unknown> }[]).map((n) => {
      if (!hoveredId) return n;
      const emphasis = n.id === hoveredId ? 'active' : neighbours.has(n.id) ? 'neighbor' : 'dim';
      return { ...n, data: { ...n.data, emphasis, hotColumns: hotByTable[n.id] } };
    });
    const dispEdges = (edges as { id: string; data?: Record<string, unknown> }[]).map((e) => {
      if (!hoveredId) return e;
      const emphasis = connIds.has(e.id) ? 'active' : 'dim';
      return { ...e, data: { ...(e.data ?? {}), emphasis } };
    });

    return (
      <ReactFlow
        nodes={dispNodes}
        edges={dispEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    );
  }, [RF, nodes, edges, onNodesChange, onEdgesChange, onConnect, onEdgesDelete, hoveredId, onNodeMouseEnter, onNodeMouseLeave, t]);

  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-sm text-muted-foreground">
        {t.descPre}<a href="https://dbml.dbdiagram.io/docs/" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2">DBML</a>{t.descPost}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={saveProject}><Save className="h-4 w-4" />{t.saveProject}</Button>
        <Button variant="secondary" onClick={exportDbmlFile}>{t.exportDbml}</Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}><FolderOpen className="h-4 w-4" />{t.open}</Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.dbml,application/json,text/plain"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void openFile(f); e.target.value = ''; }}
        />
        <span className="ml-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide">
          {saveState === 'saving' ? (
            <span className="flex items-center gap-1.5 text-amber-600"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" />{t.saving}</span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground"><Check className="h-3.5 w-3.5" />{t.saved}</span>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-4 border-2 border-border bg-muted/40 p-3">
        <div className="space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.sqlDialect}</span>
          <select value={dialect} onChange={(e) => setDialect(e.target.value as Dialect)} className="border-2 border-border bg-background px-2 py-1.5 text-sm">
            {DIALECTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
        <Button onClick={runSqlExport} disabled={!!error}>{t.exportSql}</Button>

        <div className="space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.image}</span>
          <select value={imgFormat} onChange={(e) => setImgFormat(e.target.value as ImageFormat)} className="border-2 border-border bg-background px-2 py-1.5 text-sm">
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
            <option value="svg">SVG</option>
          </select>
        </div>
        <div className="space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.scale}</span>
          <select value={imgScale} onChange={(e) => setImgScale(Number(e.target.value))} className="border-2 border-border bg-background px-2 py-1.5 text-sm">
            <option value={1}>1×</option><option value={2}>2×</option><option value={3}>3×</option>
          </select>
        </div>
        <Button variant="secondary" onClick={runImageExport}>{t.exportImage}</Button>
        {!expanded && (
          <Button variant="secondary" onClick={() => setExpandedPersist(true)}><Maximize2 className="h-4 w-4" />{t.expand}</Button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_3fr]">
        <textarea
          value={dbml}
          onChange={(e) => setDbml(e.target.value)}
          spellCheck={false}
          className="h-[75vh] w-full resize-none border-2 border-border bg-background p-3 font-mono text-xs leading-relaxed"
        />
        <div
          ref={flowWrapper}
          className={expanded
            ? 'fixed inset-x-0 bottom-0 z-30 overflow-hidden border-t-2 border-border bg-background'
            : 'h-[75vh] w-full overflow-hidden border-2 border-border'}
          style={expanded ? { top: topOffset } : undefined}
        >
          {diagram}
        </div>
      </div>

      {expanded && (
        <>
          <button
            onClick={() => setNavHiddenPersist(!navHidden)}
            title={navHidden ? t.showNavbar : t.hideNavbarSpace}
            aria-label={navHidden ? t.showNavbar : t.hideNavbar}
            className={`fixed left-1/2 z-50 -translate-x-1/2 rounded-b-md border-2 border-t-0 border-border bg-background px-5 py-0.5 shadow-brutal-sm hover:bg-muted ${navHidden ? '' : '-translate-y-full'}`}
            style={{ top: topOffset }}
          >
            {navHidden ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <div className="fixed right-4 z-40 flex items-center gap-3" style={{ top: topOffset + 8 }}>
            <Button variant="secondary" onClick={() => setExpandedPersist(false)} className="shadow-brutal"><Minimize2 className="h-4 w-4" />{t.exit}</Button>
          </div>
        </>
      )}

      {sqlErr && <Alert variant="error">{sqlErr}</Alert>}
      {sql && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(sql)}>{t.copySql}</Button>
            <Button variant="secondary" onClick={() => downloadService.download(new Blob([sql], { type: 'text/sql' }), `schema-${dialect}.sql`)}>{t.downloadSql}</Button>
          </div>
          <pre className="max-h-[40vh] overflow-auto border-2 border-border bg-background p-3 font-mono text-xs">{sql}</pre>
        </div>
      )}
      {imgBlob && <ImageResult blob={imgBlob} filename={`db-diagram.${imgFormat === 'jpeg' ? 'jpg' : imgFormat}`} />}
    </div>
  );
}
