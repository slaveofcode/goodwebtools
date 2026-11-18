import { describe, it, expect, vi, afterEach } from 'vitest';
import { sortSegments, fetchHls, HlsError } from './hls-to-mp4.lib';

const f = (name: string) => new File(['x'], name);

describe('sortSegments', () => {
  it('joins segments in natural order', () => {
    expect(sortSegments([f('seg10.ts'), f('seg2.ts'), f('seg1.ts')]).map(x => x.name)).toEqual(['seg1.ts', 'seg2.ts', 'seg10.ts']);
  });
});

function serve(files: Record<string, string | null>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const body = files[new URL(url).pathname];
    if (body === undefined) throw new TypeError('Failed to fetch');
    if (body === null) return new Response('', { status: 404 });
    return new Response(body);
  }));
}
afterEach(() => { vi.unstubAllGlobals(); });

const reason = (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (e instanceof HlsError ? e.reason : String(e)));

describe('fetchHls', () => {
  it('picks the best variant and joins its segments in order', async () => {
    serve({
      '/m.m3u8': '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=500\nlow.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=900\nhigh.m3u8\n',
      '/high.m3u8': '#EXTM3U\n#EXTINF:1,\na.ts\n#EXTINF:1,\nb.ts\n#EXT-X-ENDLIST\n',
      '/a.ts': 'AA', '/b.ts': 'BB',
    });
    const seen: [number, number][] = [];
    const blob = await fetchHls('https://x.test/m.m3u8', (d, t) => seen.push([d, t]));
    expect(await blob.text()).toBe('AABB');
    expect(seen.at(-1)).toEqual([2, 2]);
  });
  it('refuses an encrypted stream', async () => {
    serve({ '/e.m3u8': '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="k"\n#EXTINF:1,\na.ts\n#EXT-X-ENDLIST\n' });
    expect(await reason(fetchHls('https://x.test/e.m3u8', () => {}))).toBe('encrypted');
  });
  it('refuses a live stream', async () => {
    serve({ '/l.m3u8': '#EXTM3U\n#EXTINF:1,\na.ts\n' });
    expect(await reason(fetchHls('https://x.test/l.m3u8', () => {}))).toBe('live');
  });
  it('explains a site that blocks the download (CORS)', async () => {
    serve({});
    expect(await reason(fetchHls('https://x.test/blocked.m3u8', () => {}))).toBe('network');
  });
  it('rejects something that is not a playlist', async () => {
    serve({ '/n.m3u8': '<html>nope</html>' });
    expect(await reason(fetchHls('https://x.test/n.m3u8', () => {}))).toBe('not-hls');
  });
});

describe('fetchHls — streams it can’t join correctly are refused, not saved broken', () => {
  it('refuses a stream whose sound is a separate rendition (it would come out silent)', async () => {
    serve({
      '/m.m3u8': '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="English",DEFAULT=YES,URI="audio.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=900,AUDIO="aud"\nvideo.m3u8\n',
      '/video.m3u8': '#EXTM3U\n#EXTINF:1,\nv.ts\n#EXT-X-ENDLIST\n',
    });
    expect(await reason(fetchHls('https://x.test/m.m3u8', () => {}))).toBe('separate-audio');
  });
  it('refuses a byte-range playlist (one file listed many times)', async () => {
    serve({ '/b.m3u8': '#EXTM3U\n#EXTINF:1,\n#EXT-X-BYTERANGE:1000@0\nall.ts\n#EXTINF:1,\n#EXT-X-BYTERANGE:1000@1000\nall.ts\n#EXT-X-ENDLIST\n' });
    expect(await reason(fetchHls('https://x.test/b.m3u8', () => {}))).toBe('byterange');
  });
});
