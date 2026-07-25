import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { parseDbml, buildFlow } from '@/tools/draw/dbml.lib';
import { layoutNodes } from '@/tools/draw/layout.lib';
import { loadDoc, saveDoc, type DbDiagramDoc } from '@/tools/draw/dbdiagram.store';
import TableNode from './db-diagram/TableNode';
import RelationEdge from './db-diagram/RelationEdge';
import { Alert } from '@/components/ui/Alert';
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
  const positions = useRef<Record<string, { x: number; y: number }>>({});
  const loaded = useRef(false);

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

      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_3fr]">
        <textarea
          value={dbml}
          onChange={(e) => setDbml(e.target.value)}
          spellCheck={false}
          className="h-[75vh] w-full resize-none border-2 border-border bg-background p-3 font-mono text-xs leading-relaxed"
        />
        <div className="h-[75vh] w-full overflow-hidden border-2 border-border">{diagram}</div>
      </div>
    </div>
  );
}
