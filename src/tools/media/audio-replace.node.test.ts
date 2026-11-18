// @vitest-environment node
// Removing the audio is a copy, so it runs on real mediabunny here (no WebCodecs needed).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mbMute } from './audio-replace.lib';
import { MediaInputError } from './run-media.lib';
import { loadMediabunny } from '@/services/media/mediabunny.service';

const FIX = join(__dirname, '..', '..', '..', 'e2e', 'fixtures', 'media');
const file = (name: string) => new File([readFileSync(join(FIX, name))], name);

async function tracks(blob: Blob) {
  const mb = await loadMediabunny();
  const input = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.ALL_FORMATS });
  const v = await input.getPrimaryVideoTrack();
  return { video: !!v, audio: !!(await input.getPrimaryAudioTrack()), packets: v ? (await v.computePacketStats()).packetCount : 0 };
}

describe('mbMute', () => {
  it('drops the audio and keeps every video frame', async () => {
    const src = file('clip-h264-aac.mp4');
    const { blob, ext } = await mbMute(src);
    expect(ext).toBe('mp4');
    const before = await tracks(src);
    expect(await tracks(blob)).toEqual({ video: true, audio: false, packets: before.packets });
  });
  it('says so when the video has no audio', async () => {
    await expect(mbMute(file('clip-noaudio.mp4'))).rejects.toBeInstanceOf(MediaInputError);
  });
});
