import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { isFresh, putPendingImage, takePendingImage } from './handoff';

describe('isFresh', () => {
  it('is true within the window and false past it', () => {
    expect(isFresh(1000, 1500, 1000)).toBe(true);
    expect(isFresh(1000, 2500, 1000)).toBe(false);
    expect(isFresh(1000, 1000, 1000)).toBe(true); // boundary: exactly now
  });
});

describe('pending image channel', () => {
  beforeEach(async () => {
    // Drain anything a previous test left behind.
    await takePendingImage(Number.MAX_SAFE_INTEGER);
  });

  it('round-trips a blob and clears it (one-shot)', async () => {
    const blob = new Blob(['hello'], { type: 'image/png' });
    await putPendingImage(blob, 'shot.png');
    const first = await takePendingImage();
    expect(first?.name).toBe('shot.png');
    expect(await first?.blob.text()).toBe('hello');
    // Second take returns null — the record was consumed.
    expect(await takePendingImage()).toBeNull();
  });

  it('returns null for a record older than maxAgeMs', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    await putPendingImage(blob, 'old.png');
    expect(await takePendingImage(-1)).toBeNull(); // maxAge -1 => always stale
  });
});
