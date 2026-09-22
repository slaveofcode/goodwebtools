import { describe, it, expect, vi } from 'vitest';
import { shouldAutosave, saveToFileHandle, AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS } from './whiteboard.store';

// A fake File System Access handle for exercising saveToFileHandle without a
// real file picker. `permission` seeds queryPermission; write/close are spied.
function fakeHandle(opts: {
  permission?: PermissionState;
  noQuery?: boolean;
  noCreate?: boolean;
  throwOnCreate?: boolean;
} = {}) {
  const write = vi.fn(async () => {});
  const close = vi.fn(async () => {});
  const createWritable = opts.throwOnCreate
    ? vi.fn(async () => { throw new Error('denied'); })
    : vi.fn(async () => ({ write, close }));
  const handle: Record<string, unknown> = {};
  if (!opts.noCreate) handle.createWritable = createWritable;
  if (!opts.noQuery) handle.queryPermission = vi.fn(async () => opts.permission ?? 'granted');
  return { handle, write, close, createWritable };
}

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

describe('saveToFileHandle', () => {
  it('returns "unsupported" when there is no handle', async () => {
    expect(await saveToFileHandle(null, '{}')).toBe('unsupported');
    expect(await saveToFileHandle(undefined, '{}')).toBe('unsupported');
  });

  it('returns "unsupported" when the handle cannot create a writable', async () => {
    const { handle } = fakeHandle({ noCreate: true });
    expect(await saveToFileHandle(handle as unknown as FileSystemFileHandle, '{}')).toBe('unsupported');
  });

  it('returns "no-permission" without writing when read-write is not granted', async () => {
    const { handle, createWritable, write } = fakeHandle({ permission: 'prompt' });
    expect(await saveToFileHandle(handle as unknown as FileSystemFileHandle, '{}')).toBe('no-permission');
    // Never prompts (no user gesture on a timer) and never writes.
    expect(createWritable).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('writes the contents and returns "saved" when permission is granted', async () => {
    const { handle, write, close } = fakeHandle({ permission: 'granted' });
    expect(await saveToFileHandle(handle as unknown as FileSystemFileHandle, '{"hello":1}')).toBe('saved');
    expect(write).toHaveBeenCalledWith('{"hello":1}');
    expect(close).toHaveBeenCalledOnce();
  });

  it('treats a handle without queryPermission as granted and writes', async () => {
    const { handle, write } = fakeHandle({ noQuery: true });
    expect(await saveToFileHandle(handle as unknown as FileSystemFileHandle, 'x')).toBe('saved');
    expect(write).toHaveBeenCalledWith('x');
  });

  it('returns "error" when writing throws', async () => {
    const { handle } = fakeHandle({ permission: 'granted', throwOnCreate: true });
    expect(await saveToFileHandle(handle as unknown as FileSystemFileHandle, '{}')).toBe('error');
  });
});
