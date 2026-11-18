import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { Input, BlobSource, ALL_FORMATS } from 'mediabunny';

// HLS / TS to MP4: dropped .ts segments and a pasted .m3u8 link → one MP4.
const HLS = path.join(__dirname, '..', 'fixtures', 'media', 'hls');

async function open(page: Page) {
  await page.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
  // A stream "on another site", served from the fixtures.
  await page.route('https://streams.example/**', r => {
    const name = new URL(r.request().url()).pathname.split('/').pop()!;
    if (name === 'locked.m3u8') return r.fulfill({ body: '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="k"\n#EXTINF:1,\nseg0.ts\n#EXT-X-ENDLIST\n' });
    if (name === 'blocked.m3u8') return r.abort('failed');
    return r.fulfill({ path: path.join(HLS, name) });
  });
  await page.goto('/tools/hls-to-mp4/');
  await page.waitForFunction(() => {
    const i = document.querySelector('input[type="file"]');
    return !!i && Object.keys(i).some(k => k.startsWith('__reactProps'));
  });
}

async function save(page: Page) {
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible({ timeout: 60_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download', exact: true }).click()]);
  return dl;
}

async function check(file: string) {
  const bytes = fs.readFileSync(file);
  expect(bytes.subarray(4, 8).toString('latin1')).toBe('ftyp');
  const input = new Input({ source: new BlobSource(new Blob([bytes])), formats: ALL_FORMATS });
  expect(Math.abs((await input.computeDuration()) - 3)).toBeLessThan(0.2);
}

test('joins .ts segments dropped out of order into one MP4', async ({ page }) => {
  await open(page);
  await page.locator('input[type="file"]').setInputFiles(['seg2.ts', 'seg0.ts', 'seg1.ts'].map(n => path.join(HLS, n)));
  await expect(page.getByTestId('segment-order').locator('li')).toHaveText(['seg0.ts', 'seg1.ts', 'seg2.ts']);
  await page.getByRole('button', { name: 'Join into MP4' }).click();
  const dl = await save(page);
  expect(dl.suggestedFilename()).toBe('seg0.mp4');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)');
  await check(await dl.path());
});

test('downloads an .m3u8 stream as MP4', async ({ page }) => {
  await open(page);
  await page.getByLabel('Stream link (.m3u8)').fill('https://streams.example/show/index.m3u8');
  await page.getByRole('button', { name: 'Download as MP4' }).click();
  const dl = await save(page);
  expect(dl.suggestedFilename()).toBe('index.mp4');
  await check(await dl.path());
});

test('refuses an encrypted stream', async ({ page }) => {
  await open(page);
  await page.getByLabel('Stream link (.m3u8)').fill('https://streams.example/locked.m3u8');
  await page.getByRole('button', { name: 'Download as MP4' }).click();
  await expect(page.getByText('This stream is encrypted, so it can’t be saved.')).toBeVisible();
});

test('explains a site that does not allow the download', async ({ page }) => {
  await open(page);
  await page.getByLabel('Stream link (.m3u8)').fill('https://streams.example/blocked.m3u8');
  await page.getByRole('button', { name: 'Download as MP4' }).click();
  await expect(page.getByText('The site doesn’t allow downloading this stream', { exact: false })).toBeVisible();
});
