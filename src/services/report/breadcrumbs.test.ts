import { describe, it, expect, beforeEach } from 'vitest';
import { pushBreadcrumb, breadcrumb, getBreadcrumbs, clearBreadcrumbs, safeClone } from './breadcrumbs';

beforeEach(() => clearBreadcrumbs());

describe('breadcrumbs ring buffer', () => {
  it('records actions in order', () => {
    breadcrumb('file-selected', { size: 10 });
    breadcrumb('compress-start');
    const b = getBreadcrumbs();
    expect(b.map(x => x.action)).toEqual(['file-selected', 'compress-start']);
    expect(b[0].kind).toBe('action');
  });

  it('caps at 200 entries, evicting the oldest', () => {
    for (let i = 0; i < 250; i++) pushBreadcrumb('action', `a${i}`);
    const b = getBreadcrumbs();
    expect(b).toHaveLength(200);
    expect(b[0].action).toBe('a50');
    expect(b[199].action).toBe('a249');
  });
});

describe('safeClone', () => {
  it('drops circular references without throwing', () => {
    const o: Record<string, unknown> = { a: 1 };
    o.self = o;
    const cloned = safeClone(o) as Record<string, unknown>;
    expect(cloned.a).toBe(1);
    expect(JSON.stringify(cloned)).toContain('a'); // serializes cleanly
  });
});
