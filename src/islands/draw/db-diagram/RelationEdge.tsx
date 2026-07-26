import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from '@xyflow/react';
import { HIGHLIGHT } from './TableNode';

export interface RelationEdgeData {
  emphasis?: 'active' | 'dim';
}

export default function RelationEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, id, selected } = props;
  const data = props.data as unknown as RelationEdgeData | undefined;
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const { deleteElements } = useReactFlow();

  const hovered = data?.emphasis === 'active';
  const dim = data?.emphasis === 'dim';
  const emphasized = hovered || !!selected; // violet + thick when hovered or selected

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={24}
        style={{
          stroke: emphasized ? HIGHLIGHT.color : 'rgb(var(--border, 10 10 10))',
          strokeWidth: emphasized ? HIGHLIGHT.edgeWidth : HIGHLIGHT.edgeWidthIdle,
          strokeDasharray: hovered ? '6 3' : undefined,
          opacity: dim ? HIGHLIGHT.dimOpacity : 1,
          filter: emphasized ? HIGHLIGHT.glow : undefined,
          transition: 'stroke 120ms, stroke-width 120ms, opacity 120ms',
        }}
      />
      {selected && (
        <EdgeLabelRenderer>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void deleteElements({ edges: [{ id }] });
            }}
            title="Delete relationship"
            aria-label="Delete relationship"
            className="nodrag nopan flex h-6 w-6 items-center justify-center rounded-full border-2 border-border bg-background text-base font-bold leading-none shadow-brutal-sm hover:bg-red-500 hover:text-white"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            ×
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
