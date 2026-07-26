import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Maximize2, Minimize2, ChevronUp, ChevronDown } from 'lucide-react';
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
import '@xyflow/react/dist/style.css';

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

export default function DbDiagram() {
  // react-flow is browser-only and heavy — load it after mount (like Whiteboard).
  const [RF, setRF] = useState<{
    ReactFlow: ComponentType<Record<string, unknown>>;
    Background: ComponentType<Record<string, unknown>>;
    Controls: ComponentType<Record<string, unknown>>;
    MiniMap: ComponentType<Record<string, unknown>>;
    applyNodeChanges: (changes: unknown[], nodes: unknown[]) => unknown[];
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
  const flowWrapper = useRef<HTMLDivElement | null>(null);
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
      const positioned = layoutNodes(flow.nodes, flow.edges, positions.current);
      setNodes(positioned as unknown as Record<string, unknown>[]);
      setEdges(flow.edges.map((e) => ({ ...e, type: 'relation' })) as unknown as Record<string, unknown>[]);
    }, 400);
    return () => clearTimeout(t);
  }, [dbml]);

  // Debounced autosave of DBML + positions.
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      void saveDoc({ dbml, positions: positions.current, updatedAt: Date.now() } satisfies DbDiagramDoc);
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

  const runSqlExport = () => {
    setSqlErr(null);
    setSql(null);
    try {
      setSql(exportSql(dbml, dialect));
    } catch (e) {
      setSqlErr(e instanceof Error ? e.message : 'Export failed');
    }
  };

  const runImageExport = async () => {
    // Export the whole diagram: html-to-image captures the react-flow viewport DOM.
    const el = flowWrapper.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
    const target = el ?? flowWrapper.current;
    if (!target) return;
    setImgBlob(await exportDiagramImage(target, { format: imgFormat, scale: imgScale }));
  };

  const onNodeMouseEnter = useCallback((_e: unknown, node: { id: string }) => setHoveredId(node.id), []);
  const onNodeMouseLeave = useCallback(() => setHoveredId(null), []);

  const diagram = useMemo(() => {
    if (!RF) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading diagram…</div>;
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
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        fitView
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    );
  }, [RF, nodes, edges, onNodesChange, hoveredId, onNodeMouseEnter, onNodeMouseLeave]);

  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Write your schema in <a href="https://dbml.dbdiagram.io/docs/" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2">DBML</a> on the left; the ER diagram updates live. Drag tables to arrange them — your layout and schema are saved in your browser.
      </p>

      <div className="flex flex-wrap items-end gap-4 border-2 border-border bg-muted/40 p-3">
        <div className="space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">SQL dialect</span>
          <select value={dialect} onChange={(e) => setDialect(e.target.value as Dialect)} className="border-2 border-border bg-background px-2 py-1.5 text-sm">
            {DIALECTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
        <Button onClick={runSqlExport} disabled={!!error}>Export SQL</Button>

        <div className="space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">Image</span>
          <select value={imgFormat} onChange={(e) => setImgFormat(e.target.value as ImageFormat)} className="border-2 border-border bg-background px-2 py-1.5 text-sm">
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
            <option value="svg">SVG</option>
          </select>
        </div>
        <div className="space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">Scale</span>
          <select value={imgScale} onChange={(e) => setImgScale(Number(e.target.value))} className="border-2 border-border bg-background px-2 py-1.5 text-sm">
            <option value={1}>1×</option><option value={2}>2×</option><option value={3}>3×</option>
          </select>
        </div>
        <Button variant="secondary" onClick={runImageExport}>Export image</Button>
        {!expanded && (
          <Button variant="secondary" onClick={() => setExpandedPersist(true)}><Maximize2 className="h-4 w-4" />Expand</Button>
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
            title={navHidden ? 'Show navbar' : 'Hide navbar for more space'}
            aria-label={navHidden ? 'Show navbar' : 'Hide navbar'}
            className={`fixed left-1/2 z-50 -translate-x-1/2 rounded-b-md border-2 border-t-0 border-border bg-background px-5 py-0.5 shadow-brutal-sm hover:bg-muted ${navHidden ? '' : '-translate-y-full'}`}
            style={{ top: topOffset }}
          >
            {navHidden ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <div className="fixed right-4 z-40 flex items-center gap-3" style={{ top: topOffset + 8 }}>
            <Button variant="secondary" onClick={() => setExpandedPersist(false)} className="shadow-brutal"><Minimize2 className="h-4 w-4" />Exit</Button>
          </div>
        </>
      )}

      {sqlErr && <Alert variant="error">{sqlErr}</Alert>}
      {sql && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(sql)}>Copy SQL</Button>
            <Button variant="secondary" onClick={() => downloadService.download(new Blob([sql], { type: 'text/sql' }), `schema-${dialect}.sql`)}>Download .sql</Button>
          </div>
          <pre className="max-h-[40vh] overflow-auto border-2 border-border bg-background p-3 font-mono text-xs">{sql}</pre>
        </div>
      )}
      {imgBlob && <ImageResult blob={imgBlob} filename={`db-diagram.${imgFormat === 'jpeg' ? 'jpg' : imgFormat}`} />}
    </div>
  );
}
