import { describe, it, expect } from 'vitest';
import { exportSql } from './sql-export.lib';

const SCHEMA = `
Table users {
  id int [pk, increment]
  email varchar [not null]
}
Table posts {
  id int [pk]
  user_id int
}
Ref: posts.user_id > users.id
`;

describe('exportSql — native dialects', () => {
  it('postgres emits CREATE TABLE and a foreign key', () => {
    const sql = exportSql(SCHEMA, 'postgres');
    expect(sql).toMatch(/create table/i);
    expect(sql).toMatch(/foreign key|references/i);
  });
});

describe('exportSql — sqlite (custom)', () => {
  it('uses SQLite affinities, AUTOINCREMENT, and no schema prefix', () => {
    const sql = exportSql(SCHEMA, 'sqlite');
    expect(sql).toMatch(/create table\s+"?users"?/i);
    expect(sql).toMatch(/integer/i);
    expect(sql).toMatch(/autoincrement/i);
    expect(sql).not.toMatch(/public\./i);
    expect(sql).toMatch(/foreign key/i);
  });
});

describe('exportSql — clickhouse (custom)', () => {
  it('uses MergeTree and ORDER BY, and omits foreign keys', () => {
    const sql = exportSql(SCHEMA, 'clickhouse');
    expect(sql).toMatch(/engine\s*=\s*mergetree/i);
    expect(sql).toMatch(/order by/i);
    expect(sql).not.toMatch(/foreign key/i);
  });
});

describe('exportSql — errors', () => {
  it('throws on an unknown dialect', () => {
    // @ts-expect-error deliberately invalid
    expect(() => exportSql(SCHEMA, 'db2')).toThrow();
  });
  it('throws on invalid DBML', () => {
    expect(() => exportSql('Table {{{', 'sqlite')).toThrow();
  });
});
