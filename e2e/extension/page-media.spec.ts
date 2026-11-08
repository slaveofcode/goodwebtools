import { test as base, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// "Save images & media": the in-page collector finds video/audio/HLS, and the
// extension page downloads files and joins HLS streams. Media is served by a
// local server; the extension copy has site access already granted, so no
// permission prompt is needed.
const EXT = path.join(__dirname, '..', '..', 'extension');
const inject = fs.readFileSync(path.join(EXT, 'lib', 'inject.js'), 'utf8').replace(/^export /gm, '');

const FILES: Record<string, [string, string]> = {
  '/song.mp3': ['audio/mpeg', 'ID3-fake-mp3-bytes'],
  '/clip.webm': ['video/webm', 'fake-webm-bytes'],
  '/hls/master.m3u8': ['application/vnd.apple.mpegurl', '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=500000\nlow.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2000000\nhigh.m3u8\n'],
  '/hls/high.m3u8': ['application/vnd.apple.mpegurl', '#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\nseg1.ts\n#EXTINF:4,\nseg2.ts\n#EXTINF:4,\nseg3.ts\n#EXT-X-ENDLIST\n'],
  '/hls/low.m3u8': ['application/vnd.apple.mpegurl', '#EXTM3U\n#EXTINF:4,\nlow1.ts\n#EXT-X-ENDLIST\n'],
  '/hls/seg1.ts': ['video/mp2t', 'AAA'],
  '/hls/seg2.ts': ['video/mp2t', 'BBB'],
  '/hls/seg3.ts': ['video/mp2t', 'CCC'],
  '/locked.m3u8': ['application/vnd.apple.mpegurl', '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXTINF:4,\nx.ts\n#EXT-X-ENDLIST\n'],
  '/page': ['text/html', `<html><head><title>Media page</title>
    <meta property="og:video" content="/og.mp4"><meta property="og:video:type" content="video/mp4"></head><body>
    <video src="/clip.webm" title="A clip"></video>
    <audio><source src="/song.mp3" type="audio/mpeg"></audio>
    <a href="/files/podcast.m4a">Episode 1</a>
    <a href="/about.html">About</a>
    <script>fetch('/hls/master.m3u8');</script></body></html>`],
};

const test = base.extend<{ server: string; ctx: BrowserContext; extId: string; sw: Worker }>({
  // eslint-disable-next-line no-empty-pattern
  server: async ({}, use) => {
    const srv = http.createServer((req, res) => {
      const f = FILES[(req.url || '').split('?')[0]];
      if (!f) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': f[0], 'access-control-allow-origin': '*' });
      res.end(f[1]);
    });
    await new Promise<void>(r => srv.listen(0, '127.0.0.1', r));
    await use(`http://127.0.0.1:${(srv.address() as AddressInfo).port}`);
    srv.close();
  },
  // eslint-disable-next-line no-empty-pattern
  ctx: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gwt-ext-'));
    fs.cpSync(EXT, dir, { recursive: true });
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    manifest.host_permissions = ['<all_urls>'];
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
    const ctx = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
      acceptDownloads: true,
    });
    await use(ctx);
    await ctx.close();
    fs.rmSync(dir, { recursive: true, force: true });
  },
  sw: async ({ ctx }, use) => {
    const isExt = (w: Worker) => w.url().startsWith('chrome-extension://');
    const sw = ctx.serviceWorkers().find(isExt) ?? (await ctx.waitForEvent('serviceworker', { predicate: isExt }));
    await expect.poll(() => sw.evaluate(() => typeof chrome !== 'undefined' && !!chrome.storage?.local), { timeout: 15_000 }).toBe(true);
    await sw.evaluate(() => chrome.storage.local.set({ gwtBase: 'http://localhost:4321', gwtLang: 'en' }));
    await use(sw);
  },
  extId: async ({ sw }, use) => { await use(new URL(sw.url()).host); },
});

type Found = { media: { src: string; kind: string | null; label: string; type: string }[]; streamed: boolean; title: string; url: string };

test('collects video, audio, media links, og:video and fetched HLS from a page', async ({ ctx, server }) => {
  const page = await ctx.newPage();
  await page.goto(`${server}/page`);
  await page.waitForLoadState('networkidle');
  await page.addScriptTag({ content: inject });
  const found = await page.evaluate(() => (window as unknown as { collectPageMedia: () => Found }).collectPageMedia());
  const srcs = found.media.map(m => m.src);
  expect(srcs).toEqual(expect.arrayContaining([
    `${server}/clip.webm`, `${server}/song.mp3`, `${server}/files/podcast.m4a`, `${server}/og.mp4`, `${server}/hls/master.m3u8`,
  ]));
  expect(srcs).not.toContain(`${server}/about.html`);
  expect(found.media.find(m => m.src.endsWith('/podcast.m4a'))?.label).toBe('Episode 1');
  expect(found.streamed).toBe(false);
});

test('a player fed by MediaSource is reported as streamed', async ({ ctx, server }) => {
  const page = await ctx.newPage();
  await page.goto(`${server}/page`);
  await page.evaluate(() => { const v = document.createElement('video'); v.src = URL.createObjectURL(new MediaSource()); document.body.append(v); });
  await page.addScriptTag({ content: inject });
  const found = await page.evaluate(() => (window as unknown as { collectPageMedia: () => Found }).collectPageMedia());
  expect(found.streamed).toBe(true);
  expect(found.media.some(m => m.src.startsWith('blob:'))).toBe(false);
});

async function openPicker(ctx: BrowserContext, sw: Worker, extId: string, pageImages: unknown) {
  await sw.evaluate((v) => chrome.storage.session.set({ pageImages: v }), pageImages);
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extId}/images.html`);
  return page;
}

test('the picker lists video and audio, downloads a file and joins an HLS stream', async ({ ctx, sw, extId, server }) => {
  const page = await openPicker(ctx, sw, extId, { url: `${server}/page`, title: 'Media page', images: [], media: [
    { src: `${server}/clip.webm`, kind: 'video', label: 'A clip' },
    { src: `${server}/hls/master.m3u8`, kind: null, label: '' },
    { src: `${server}/song.mp3`, kind: 'audio', label: '' },
  ] });
  await expect(page.locator('#from')).toHaveText('2 videos, 1 audio file from 127.0.0.1');
  await expect(page.getByRole('tab', { name: 'Images (0)' })).toBeHidden();
  await expect(page.getByRole('tab', { name: 'Video (2)' })).toHaveAttribute('aria-selected', 'true');

  // A plain file downloads as is.
  const clip = page.locator('#rows-video .row').filter({ hasText: 'A clip' });
  const [dl] = await Promise.all([page.waitForEvent('download'), clip.getByRole('button', { name: 'Download' }).click()]);
  expect(dl.suggestedFilename()).toBe('clip.webm');
  expect(fs.readFileSync(await dl.path(), 'utf8')).toBe('fake-webm-bytes');

  // HLS: the best variant's segments, joined in order, named after the page.
  const hls = page.locator('#rows-video .row').filter({ hasText: 'Stream (HLS)' });
  const [dl2] = await Promise.all([page.waitForEvent('download'), hls.getByRole('button', { name: 'Download' }).click()]);
  expect(dl2.suggestedFilename()).toBe('Media-page-2.ts');
  expect(fs.readFileSync(await dl2.path(), 'utf8')).toBe('AAABBBCCC');
  await expect(hls.locator('.status')).toContainText('Video Converter');

  await page.getByRole('tab', { name: 'Audio (1)' }).click();
  const [dl3] = await Promise.all([page.waitForEvent('download'), page.locator('#rows-audio .row').getByRole('button', { name: 'Download' }).click()]);
  expect(dl3.suggestedFilename()).toBe('song.mp3');
});

test('an encrypted stream is explained, not downloaded', async ({ ctx, sw, extId, server }) => {
  const page = await openPicker(ctx, sw, extId, { url: `${server}/page`, title: 'x', images: [], media: [{ src: `${server}/locked.m3u8`, kind: null }] });
  const row = page.locator('#rows-video .row');
  await row.getByRole('button', { name: 'Download' }).click();
  await expect(row.locator('.status')).toHaveText('This stream is encrypted, so it can’t be saved.');
});

test('YouTube pages get a note instead of a media list', async ({ ctx, sw, extId }) => {
  const page = await openPicker(ctx, sw, extId, { url: 'https://www.youtube.com/watch?v=abc', title: 'Video', images: [], media: [{ src: 'https://example.com/v.mp4', kind: 'video' }] });
  await expect(page.locator('#note')).toHaveText('Saving video and audio isn’t available on YouTube or SoundCloud.');
  await expect(page.locator('#rows-video .row')).toHaveCount(0);
  await expect(page.locator('#from')).toHaveText('No images, video or audio found on this page.');
});
