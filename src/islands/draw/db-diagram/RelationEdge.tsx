import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import { HIGHLIGHT } from './TableNode';

export interface RelationEdgeData {
  emphasis?: 'active' | 'dim';
}

export default function RelationEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;
  const data = props.data as unknown as RelationEdgeData | undefined;
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const active = data?.emphasis === 'active';
  const dim = data?.emphasis === 'dim';
  return (
    <BaseEdge
      id={props.id}
      path={path}
      style={{
        stroke: active ? HIGHLIGHT.color : 'rgb(var(--border, 10 10 10))',
        strokeWidth: active ? HIGHLIGHT.edgeWidth : HIGHLIGHT.edgeWidthIdle,
        strokeDasharray: active ? '6 3' : undefined,
        opacity: dim ? HIGHLIGHT.dimOpacity : 1,
        filter: active ? HIGHLIGHT.glow : undefined,
        transition: 'stroke 120ms, stroke-width 120ms, opacity 120ms',
      }}
    />
  );
}
