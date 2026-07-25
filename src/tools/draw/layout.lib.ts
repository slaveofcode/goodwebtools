import dagre from '@dagrejs/dagre';
import type { DiagramNode, DiagramEdge } from './dbml.lib';

export type PositionedNode = DiagramNode & { position: { x: number; y: number } };

const COL_HEIGHT = 26;
const HEADER = 40;
const NODE_WIDTH = 220;

/** Position nodes: saved positions win; the rest are laid out left-to-right with dagre. */
export function layoutNodes(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  saved: Record<string, { x: number; y: number }>,
): PositionedNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: HEADER + n.data.columns.length * COL_HEIGHT });
  }
  for (const e of edges) {
    if (nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target)) {
      g.setEdge(e.source, e.target);
    }
  }
  dagre.layout(g);
  return nodes.map((n) => {
    if (saved[n.id]) return { ...n, position: saved[n.id] };
    const p = g.node(n.id);
    // dagre centers nodes; shift to top-left origin for react-flow.
    return { ...n, position: { x: Math.round(p.x - NODE_WIDTH / 2), y: Math.round(p.y - (HEADER + n.data.columns.length * COL_HEIGHT) / 2) } };
  });
}
