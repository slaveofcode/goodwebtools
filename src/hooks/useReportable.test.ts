import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReportable } from './useReportable';
import { getCurrentFile } from '@/services/report/reporter';

describe('useReportable', () => {
  it('registers the current file and updates on change', () => {
    const a = new File(['a'], 'a.png', { type: 'image/png' });
    const b = new File(['b'], 'b.png', { type: 'image/png' });
    const { rerender, unmount } = renderHook(({ f }) => useReportable({ toolId: 'image-compress', file: f }), {
      initialProps: { f: a as File | null },
    });
    expect(getCurrentFile()).toBe(a);
    rerender({ f: b });
    expect(getCurrentFile()).toBe(b);
    unmount();
    expect(getCurrentFile()).toBeNull();
  });
});
