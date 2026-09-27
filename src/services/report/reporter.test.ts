import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setContext, clearContext, getCurrentFile, setLastError, takeLastError, onOpen, openReportDialog } from './reporter';

beforeEach(() => { clearContext('image-compress'); clearContext('other'); takeLastError(); });

describe('reporter bus', () => {
  it('exposes the current tool file via the registered getter', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    setContext({ toolId: 'image-compress', getFile: () => file });
    expect(getCurrentFile()).toBe(file);
  });

  it('clearContext only clears a matching toolId', () => {
    setContext({ toolId: 'image-compress', getFile: () => null });
    clearContext('other');
    expect(getCurrentFile()).toBeNull(); // still the image-compress ctx, whose file is null
    clearContext('image-compress');
    expect(getCurrentFile()).toBeNull();
  });

  it('notifies open listeners with the prefill and stashes lastError', () => {
    const seen: unknown[] = [];
    const off = onOpen(p => seen.push(p));
    const err = new Error('boom');
    setLastError(err);
    openReportDialog({ error: err });
    expect(seen).toEqual([{ error: err }]);
    expect(takeLastError()).toBe(err);
    off();
  });
});
