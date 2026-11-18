// @vitest-environment node
// Metadata rotation is a copy: no WebCodecs needed, so it runs on real mediabunny here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mbRotate } from './video-rotate.lib';
import { loadMediabunny } from '@/services/media/mediabunny.service';

const FIX = join(__dirname, '..', '..', '..', 'e2e', 'fixtures', 'media');
const file = (name: string) => new File([readFileSync(join(FIX, name))], name);

async function rotationOf(blob: Blob) {
  const mb = await loadMediabunny();
  const input = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.ALL_FORMATS });
  const v = (await input.getPrimaryVideoTrack())!;
  return { rotation: await v.getRotation(), width: await v.getCodedWidth(), audio: !!(await input.getPrimaryAudioTrack()) };
}

describe('mbRotate (metadata)', () => {
  it('turns a video 90° without re-encoding it', async () => {
    const src = file('clip-h264-aac.mp4');
    const { blob, ext } = await mbRotate(src, { turn: 90, flip: false, bake: false });
    expect(ext).toBe('mp4');
    expect(await rotationOf(blob)).toEqual({ rotation: 90, width: 640, audio: true });
    expect(Math.abs(blob.size - src.size) / src.size).toBeLessThan(0.05);
  });
  it('adds to a rotation the video already has (270° + 90° = upright)', async () => {
    const { blob } = await mbRotate(file('clip-portrait.mp4'), { turn: 90, flip: false, bake: false });
    expect((await rotationOf(blob)).rotation).toBe(0);
  });
});
