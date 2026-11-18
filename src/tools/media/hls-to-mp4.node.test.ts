// @vitest-environment node
// Joined MPEG-TS segments → one MP4 (a copy), on real mediabunny.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { toMp4 } from './hls-to-mp4.lib';
import { loadMediabunny } from '@/services/media/mediabunny.service';

const HLS = join(__dirname, '..', '..', '..', 'e2e', 'fixtures', 'media', 'hls');

describe('toMp4', () => {
  it('turns joined .ts segments into one MP4 without re-encoding', async () => {
    const parts = readdirSync(HLS).filter(n => n.endsWith('.ts')).sort().map(n => readFileSync(join(HLS, n)));
    const mp4 = await toMp4(new Blob(parts));
    const mb = await loadMediabunny();
    const input = new mb.Input({ source: new mb.BlobSource(mp4), formats: mb.ALL_FORMATS });
    expect((await input.getFormat()).name).toBe('MP4');
    expect(await (await input.getPrimaryVideoTrack())!.getCodec()).toBe('avc');
    expect(await (await input.getPrimaryAudioTrack())!.getCodec()).toBe('aac');
    expect(Math.abs((await input.computeDuration()) - 3)).toBeLessThan(0.2);
  });
});
