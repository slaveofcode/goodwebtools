import { describe, it, expect } from 'vitest';
import { shouldAutosave, AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS } from './whiteboard.store';

describe('shouldAutosave', () => {
  it('never saves when there are no unsaved changes', () => {
    expect(shouldAutosave({ dirty: false, idleMs: 9999, dirtyForMs: 9999 })).toBe(false);
  });

  it('does not save while the user is still actively changing (not idle, not capped)', () => {
    expect(shouldAutosave({ dirty: true, idleMs: 100, dirtyForMs: 100 })).toBe(false);
  });

  it('saves once the user has paused for the debounce window', () => {
    expect(shouldAutosave({ dirty: true, idleMs: AUTOSAVE_DEBOUNCE_MS, dirtyForMs: AUTOSAVE_DEBOUNCE_MS })).toBe(true);
  });

  it('force-saves during continuous drawing once the max wait is exceeded', () => {
    // Still actively drawing (idle ~0) but pending for a long time → save anyway.
    expect(shouldAutosave({ dirty: true, idleMs: 50, dirtyForMs: AUTOSAVE_MAX_WAIT_MS })).toBe(true);
  });

  it('respects custom timings', () => {
    expect(shouldAutosave({ dirty: true, idleMs: 300, dirtyForMs: 300, debounceMs: 500, maxWaitMs: 2000 })).toBe(false);
    expect(shouldAutosave({ dirty: true, idleMs: 500, dirtyForMs: 500, debounceMs: 500, maxWaitMs: 2000 })).toBe(true);
  });
});
