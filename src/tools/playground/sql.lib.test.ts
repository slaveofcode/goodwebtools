import { describe, it, expect } from 'vitest';
import { splitStatements, classifyStatement } from './sql.lib';

describe('splitStatements', () => {
  it('splits on semicolons', () => {
    expect(splitStatements('SELECT 1; SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2']);
  });
  it('ignores semicolons inside string literals', () => {
    expect(splitStatements("INSERT INTO t VALUES ('a;b'); SELECT 1")).toEqual([
      "INSERT INTO t VALUES ('a;b')",
      'SELECT 1',
    ]);
  });
  it('ignores semicolons in line and block comments', () => {
    expect(splitStatements('SELECT 1; -- a;b\nSELECT 2; /* c;d */ SELECT 3')).toEqual([
      'SELECT 1',
      '-- a;b\nSELECT 2',
      '/* c;d */ SELECT 3',
    ]);
  });
  it('drops trailing empty statements', () => {
    expect(splitStatements('SELECT 1;   ;')).toEqual(['SELECT 1']);
  });
});

describe('classifyStatement', () => {
  it('classifies by leading keyword, skipping comments', () => {
    expect(classifyStatement('  -- hi\n SELECT * FROM t')).toBe('select');
    expect(classifyStatement('WITH x AS (SELECT 1) SELECT * FROM x')).toBe('select');
    expect(classifyStatement('PRAGMA table_info(t)')).toBe('select');
    expect(classifyStatement('CREATE TABLE t (a)')).toBe('ddl');
    expect(classifyStatement('DROP TABLE t')).toBe('ddl');
    expect(classifyStatement('INSERT INTO t VALUES (1)')).toBe('dml');
    expect(classifyStatement('UPDATE t SET a=1')).toBe('dml');
    expect(classifyStatement('BEGIN')).toBe('other');
  });
});
