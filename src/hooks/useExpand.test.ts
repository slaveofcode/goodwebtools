import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExpand } from './useExpand';

describe('useExpand', () => {
  it('starts collapsed', () => {
    const { result } = renderHook(() => useExpand());
    expect(result.current.expanded).toBe(false);
  });

  it('enter() expands (overlay fallback when Fullscreen API is unavailable)', () => {
    const { result } = renderHook(() => useExpand());
    act(() => result.current.enter());
    expect(result.current.expanded).toBe(true);
  });

  it('exit() collapses', () => {
    const { result } = renderHook(() => useExpand());
    act(() => result.current.enter());
    act(() => result.current.exit());
    expect(result.current.expanded).toBe(false);
  });

  it('Escape collapses while expanded', () => {
    const { result } = renderHook(() => useExpand());
    act(() => result.current.enter());
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(result.current.expanded).toBe(false);
  });

  it('Escape does nothing when already collapsed', () => {
    const { result } = renderHook(() => useExpand());
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(result.current.expanded).toBe(false);
  });
});
