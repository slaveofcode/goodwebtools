// @vitest-environment node
// Size limits and the "already has a duration" check, with mediabunny mocked
// (the real conversions are covered by the extension E2E tests).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mb = vi.hoisted(() => {
  const state = { duration: null, inputs: 0 };
  class Input { constructor() { state.inputs++; } async getDurationFromMetadata() { return state.duration; } dispose() {} }
  return { state, mod: { Input, BlobSource: class {}, ALL_FORMATS: [] } };
});
vi.mock('../vendor/mediabunny.js', () => mb.mod);

import { remuxWebm, toMp4, MAX_REPACK_BYTES } from './transmux.js';

beforeEach(() => { mb.state.duration = null; mb.state.inputs = 0; });
const huge = { size: MAX_REPACK_BYTES + 1, type: 'video/webm' };

describe('transmux limits', () => {
  it('does not re-pack a very large recording (keeps the original)', async () => {
    expect(await remuxWebm(huge)).toBeNull();
    expect(mb.state.inputs).toBe(0);
  });
  it('does not convert a very large stream to MP4 (keeps the .ts)', async () => {
    expect(await toMp4(huge)).toBeNull();
    expect(mb.state.inputs).toBe(0);
  });
  it('leaves a recording that already has a duration as it is', async () => {
    mb.state.duration = 12.5;
    expect(await remuxWebm(new Blob(['x'], { type: 'video/webm' }))).toBeNull();
    expect(mb.state.inputs).toBe(1); // read the header only
  });
});
