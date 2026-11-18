// @vitest-environment node
// Media Info on real files (mediabunny reads containers and tracks without WebCodecs).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readMediaInfo } from './media-info.lib';
import { MediaInputError } from './run-media.lib';

const FIX = join(__dirname, '..', '..', '..', 'e2e', 'fixtures', 'media');
const file = (name: string, type = '') => new File([readFileSync(join(FIX, name))], name, { type });

describe('readMediaInfo', () => {
  it('describes an MP4 with H.264 video and AAC audio', async () => {
    const info = await readMediaInfo(file('clip-h264-aac.mp4', 'video/mp4'));
    expect(info.container).toBe('MP4');
    expect(info.durationSec).toBeCloseTo(3, 1);
    expect(info.bitrate).toBeGreaterThan(0);
    const v = info.tracks.find(t => t.kind === 'video')!;
    expect(v).toMatchObject({ codec: 'avc', width: 640, height: 360, rotation: 0, frameRate: 30 });
    expect(info.tracks.find(t => t.kind === 'audio')).toMatchObject({ codec: 'aac', sampleRate: 48000, channels: 1 });
  });
  it('reports rotation and the size it displays at', async () => {
    const v = (await readMediaInfo(file('clip-portrait.mp4'))).tracks.find(t => t.kind === 'video')!;
    expect(v).toMatchObject({ rotation: 270, width: 640, height: 360, displayWidth: 360, displayHeight: 640 }); // clockwise (ffprobe shows it as 90 counter-clockwise)
  });
  it('includes tags and cover art', async () => {
    const info = await readMediaInfo(file('tagged.m4a'));
    expect(info.tags.title).toBe('Test Tone');
    expect(info.tags.picture?.mime).toBe('image/png');
  });
  it('rejects a container it cannot read', async () => {
    await expect(readMediaInfo(file('clip.avi'))).rejects.toBeInstanceOf(MediaInputError);
  });
});
