import { describe, it, expect } from 'vitest';
import { parseDbml, buildFlow } from './dbml.lib';

const SCHEMA = `
Table users {
  id int [pk, increment]
  email varchar [not null, unique]
}
Table posts {
  id int [pk]
  user_id int
  title varchar
}
Ref: posts.user_id > users.id
`;

describe('parseDbml', () => {
  it('parses valid DBML without error', () => {
    const { db, error } = parseDbml(SCHEMA);
    expect(error).toBeNull();
    expect(db).not.toBeNull();
  });
  it('reports an error for invalid DBML without throwing', () => {
    const { db, error } = parseDbml('Table {{{ broken');
    expect(db).toBeNull();
    expect(error).toBeTruthy();
  });
  it('treats empty input as empty, not an error', () => {
    const { db, error } = parseDbml('');
    expect(error).toBeNull();
    expect(buildFlow(db)).toEqual({ nodes: [], edges: [] });
  });
});

describe('buildFlow', () => {
  it('maps tables to nodes with column flags', () => {
    const { db } = parseDbml(SCHEMA);
    const { nodes } = buildFlow(db);
    expect(nodes.map((n) => n.id).sort()).toEqual(['posts', 'users']);
    const users = nodes.find((n) => n.id === 'users')!;
    const id = users.data.columns.find((c) => c.name === 'id')!;
    expect(id.pk).toBe(true);
    const email = users.data.columns.find((c) => c.name === 'email')!;
    expect(email.notNull).toBe(true);
    expect(email.unique).toBe(true);
  });
  it('maps a ref to an edge with column-level handles', () => {
    const { db } = parseDbml(SCHEMA);
    const { edges } = buildFlow(db);
    expect(edges).toHaveLength(1);
    const e = edges[0];
    const endpoints = [`${e.source}.${e.sourceHandle}`, `${e.target}.${e.targetHandle}`].sort();
    expect(endpoints).toEqual(['posts.user_id', 'users.id']);
  });
});
