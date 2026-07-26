import { describe, it, expect } from 'vitest';
import { layoutNodes } from './layout.lib';
import type { DiagramNode, DiagramEdge } from './dbml.lib';

const node = (id: string, cols = 2): DiagramNode => ({
  id,
  type: 'table',
  data: { name: id, columns: Array.from({ length: cols }, (_, i) => ({ name: `c${i}`, type: 'int', pk: i === 0, fk: false, notNull: false, unique: false })) },
});

describe('layoutNodes', () => {
  const nodes = [node('a'), node('b')];
  const edges: DiagramEdge[] = [{ id: 'e', source: 'a', target: 'b', sourceHandle: 'c0', targetHandle: 'c0', data: { relation: '*-1' } }];

  it('keeps saved positions and computes the rest', () => {
    const out = layoutNodes(nodes, edges, { a: { x: 500, y: 500 } });
    expect(out).toHaveLength(2);
    expect(out.find((n) => n.id === 'a')!.position).toEqual({ x: 500, y: 500 });
    expect(out.find((n) => n.id === 'b')!.position).toBeDefined();
  });
  it('gives unsaved nodes distinct positions', () => {
    const out = layoutNodes(nodes, edges, {});
    const [a, b] = ['a', 'b'].map((id) => out.find((n) => n.id === id)!.position);
    expect(a.x !== b.x || a.y !== b.y).toBe(true);
  });
});
