import { describe, it, expect } from 'vitest';
import { quoteIdent, mapColumnInfo } from './schema.lib';

describe('quoteIdent', () => {
  it('wraps in double quotes and escapes embedded quotes', () => {
    expect(quoteIdent('users')).toBe('"users"');
    expect(quoteIdent('we"ird')).toBe('"we""ird"');
  });
});

describe('mapColumnInfo', () => {
  it('maps PRAGMA table_info rows to ColumnInfo', () => {
    const rows = [
      { name: 'id', type: 'INTEGER', notnull: 1, pk: 1 },
      { name: 'email', type: 'TEXT', notnull: 0, pk: 0 },
    ];
    expect(mapColumnInfo(rows)).toEqual([
      { name: 'id', type: 'INTEGER', pk: true, notnull: true },
      { name: 'email', type: 'TEXT', pk: false, notnull: false },
    ]);
  });
});
