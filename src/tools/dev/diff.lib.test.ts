import { describe, it, expect } from 'vitest';
import { diffLines } from './diff.lib';

describe('diffLines', () => {
  it('marks every row equal for identical inputs', () => {
    const lines = ['a', 'b', 'c'];
    const rows = diffLines(lines, lines);
    expect(rows).toHaveLength(3);
    expect(rows.every(r => r.type === 'equal')).toBe(true);
    expect(rows.map(r => r.text)).toEqual(lines);
  });

  it('produces one remove and one add for a changed line', () => {
    const rows = diffLines(['a', 'b', 'c'], ['a', 'x', 'c']);
    expect(rows.filter(r => r.type === 'remove')).toEqual([{ type: 'remove', text: 'b' }]);
    expect(rows.filter(r => r.type === 'add')).toEqual([{ type: 'add', text: 'x' }]);
    expect(rows.filter(r => r.type === 'equal').map(r => r.text)).toEqual(['a', 'c']);
  });

  it('marks an inserted line as add', () => {
    const rows = diffLines(['a', 'c'], ['a', 'b', 'c']);
    expect(rows.filter(r => r.type === 'add')).toEqual([{ type: 'add', text: 'b' }]);
    expect(rows.filter(r => r.type === 'remove')).toHaveLength(0);
  });

  it('marks a deleted line as remove', () => {
    const rows = diffLines(['a', 'b', 'c'], ['a', 'c']);
    expect(rows.filter(r => r.type === 'remove')).toEqual([{ type: 'remove', text: 'b' }]);
    expect(rows.filter(r => r.type === 'add')).toHaveLength(0);
  });

  it('marks everything add for empty-vs-non-empty', () => {
    const rows = diffLines([''], ['a', 'b']);
    // '' matches nothing in the right, so it is removed and both right lines added.
    expect(rows.filter(r => r.type === 'add').map(r => r.text)).toEqual(['a', 'b']);
    expect(rows.filter(r => r.type === 'remove').map(r => r.text)).toEqual(['']);
  });

  it('marks everything remove for non-empty-vs-empty', () => {
    const rows = diffLines(['a', 'b'], ['']);
    expect(rows.filter(r => r.type === 'remove').map(r => r.text)).toEqual(['a', 'b']);
    expect(rows.filter(r => r.type === 'add').map(r => r.text)).toEqual(['']);
  });

  it('reconstructs the original left and right from the diff rows', () => {
    const left = ['one', 'two', 'three', 'four'];
    const right = ['one', 'TWO', 'three', 'five', 'four'];
    const rows = diffLines(left, right);

    const reconstructedLeft = rows
      .filter(r => r.type === 'equal' || r.type === 'remove')
      .map(r => r.text);
    const reconstructedRight = rows
      .filter(r => r.type === 'equal' || r.type === 'add')
      .map(r => r.text);

    expect(reconstructedLeft).toEqual(left);
    expect(reconstructedRight).toEqual(right);
  });
});
