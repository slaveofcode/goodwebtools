// @vitest-environment node
// Tags and cover art from M4A/FLAC/WAV via mediabunny (metadata reading needs no WebCodecs).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readMediaTags } from './mb-media.lib';

const FIX = join(__dirname, '..', '..', '..', 'e2e', 'fixtures', 'media');
const file = (name: string) => new Blob([readFileSync(join(FIX, name))]);
const PNG = [0x89, 0x50, 0x4e, 0x47];

describe('readMediaTags', () => {
  it.each(['tagged.m4a', 'tagged.flac'])('reads title, artist, album, year and cover from %s', async name => {
    const tags = await readMediaTags(file(name));
    expect(tags).toMatchObject({ title: 'Test Tone', artist: 'GoodWebTools', album: 'Fixtures', year: '2026' });
    expect(tags.picture?.mime).toBe('image/png');
    expect([...tags.picture!.data.subarray(0, 4)]).toEqual(PNG);
  });
  it('gives no fields for a file without tags', async () => {
    expect(await readMediaTags(file('tone.wav'))).toEqual({});
  });
  it('never throws on a file it cannot read', async () => {
    expect(await readMediaTags(new Blob(['not media at all']))).toEqual({});
  });
});
