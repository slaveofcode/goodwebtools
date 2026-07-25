import { Handle, Position, type NodeProps } from '@xyflow/react';
import { KeyRound, Link2 } from 'lucide-react';
import type { TableColumn } from '@/tools/draw/dbml.lib';

// Central, tunable emphasis config — bolder than dbdiagram.io's defaults.
export const HIGHLIGHT = {
  edgeWidth: 3.5,
  edgeWidthIdle: 1.5,
  color: 'var(--accent, #f59e0b)',
  glow: 'drop-shadow(0 0 4px var(--accent, #f59e0b))',
  dimOpacity: 0.25,
  nodeBorderWidth: 2.5,
};

export interface TableNodeData {
  name: string;
  columns: TableColumn[];
  /** injected by the island on hover: 'active' | 'neighbor' | 'dim' | undefined */
  emphasis?: 'active' | 'neighbor' | 'dim';
  /** set of `${column}` names to highlight (FK/PK endpoints) */
  hotColumns?: Set<string>;
}

export default function TableNode({ data }: NodeProps) {
  const d = data as unknown as TableNodeData;
  const emphasized = d.emphasis === 'active' || d.emphasis === 'neighbor';
  const style: React.CSSProperties = {
    opacity: d.emphasis === 'dim' ? HIGHLIGHT.dimOpacity : 1,
    borderWidth: emphasized ? HIGHLIGHT.nodeBorderWidth : 2,
    borderColor: emphasized ? HIGHLIGHT.color : undefined,
    filter: d.emphasis === 'active' ? HIGHLIGHT.glow : undefined,
    transition: 'opacity 120ms, border-color 120ms, filter 120ms',
  };

  return (
    <div className="min-w-[200px] border-2 border-border bg-background text-sm shadow-brutal-sm" style={style}>
      <div className="border-b-2 border-border bg-muted px-3 py-1.5 font-bold">{d.name}</div>
      <div>
        {d.columns.map((c) => {
          const hot = d.hotColumns?.has(c.name);
          return (
            <div
              key={c.name}
              className="relative flex items-center justify-between gap-3 px-3 py-1"
              style={hot ? { background: HIGHLIGHT.color, color: '#000' } : undefined}
            >
              {/* Column-level handles (both sides) so edges attach at the row. */}
              <Handle type="target" position={Position.Left} id={c.name} style={{ opacity: 0 }} />
              <span className="flex items-center gap-1 font-mono">
                {c.pk && <KeyRound className="h-3 w-3" />}
                {c.fk && !c.pk && <Link2 className="h-3 w-3" />}
                {c.name}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{c.type}</span>
              <Handle type="source" position={Position.Right} id={c.name} style={{ opacity: 0 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
