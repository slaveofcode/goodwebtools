// @vitest-environment node
// Re-packing runs on real mediabunny (a stream copy needs no WebCodecs, so it works in Node).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mbRemux } from './mb-media.lib';

const FIX = join(__dirname, '..', '..', '..', 'e2e', 'fixtures', 'media');
const has = (b: Uint8Array, id: number[]) => Buffer.from(b).includes(Buffer.from(id));
const DURATION = [0x44, 0x89];
const CUES = [0x1c, 0x53, 0xbb, 0x6b];

describe('mbRemux', () => {
  it('gives a MediaRecorder-style WebM (no Duration, no Cues) a duration and a seek index', async () => {
    const raw = new Uint8Array(readFileSync(join(FIX, 'clip-live.webm')));
    expect(has(raw, CUES)).toBe(false);
    const out = new Uint8Array(await (await mbRemux(new Blob([raw], { type: 'video/webm' }), 'webm')).arrayBuffer());
    expect(has(out, DURATION)).toBe(true);
    expect(has(out, CUES)).toBe(true);
    expect(out.length).toBeGreaterThan(raw.length * 0.9);
  });
});
