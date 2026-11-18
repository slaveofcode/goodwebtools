import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Video Compressor: the fast engine (mediabunny / WebCodecs) handles MP4/WebM,
// ffmpeg.wasm handles the rest (AVI here). Fixtures are a generated test
// pattern + tone (scripts/make-media-fixtures.sh).
const FIX = path.join(__dirname, '..', 'fixtures', 'media');

async function open(page: Page) {
  await page.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
  await page.goto('/tools/video-compress/');
  await page.waitForFunction(() => {
    const i = document.querySelector('input[type="file"]');
    return !!i && Object.keys(i).some(k => k.startsWith('__reactProps'));
  });
}

async function compress(page: Page, fixture: string, preset = '8 MB') {
  await page.locator('input[type="file"]').setInputFiles(path.join(FIX, fixture));
  await expect(page.getByText(/Duration \d+s/)).toBeVisible();
  await page.locator('select').filter({ has: page.locator('option', { hasText: preset }) }).selectOption({ label: preset });
  await page.getByRole('button', { name: 'Compress', exact: true }).click();
}

test('compresses an MP4 on the fast engine, keeping H.264 video and AAC audio', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await compress(page, 'clip-h264-aac.mp4');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  await expect(page.getByTestId('result-meta')).toContainText('avc');
  await expect(page.getByTestId('result-meta')).toContainText('aac');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download MP4' }).click()]);
  expect(dl.suggestedFilename()).toBe('clip-h264-aac-compressed.mp4');
});

test('a portrait phone clip stays upright', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await compress(page, 'clip-portrait.mp4');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  // Displayed size: taller than wide.
  const dims = await page.locator('video').last().evaluate((v: HTMLVideoElement) => new Promise<[number, number]>(r => {
    const done = () => r([v.videoWidth, v.videoHeight]);
    if (v.readyState >= 1) done(); else v.addEventListener('loadedmetadata', done, { once: true });
  }));
  expect(dims[1]).toBeGreaterThan(dims[0]);
});

test('a video without audio compresses without errors', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await compress(page, 'clip-noaudio.mp4');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  await expect(page.getByTestId('result-meta')).not.toContainText('aac');
});

/** A browser without WebCodecs (older Firefox/Safari): everything runs on ffmpeg.wasm. */
async function withoutWebCodecs(page: Page) {
  // The ffmpeg.wasm core is served from /models/ffmpeg (R2 in production, staged
  // locally with `npm run stage:models`); serve it from node_modules here.
  const CORE = path.join(__dirname, '..', '..', 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
  await page.route('**/models/ffmpeg/*', r => r.fulfill({ path: path.join(CORE, new URL(r.request().url()).pathname.split('/').pop()!) }));
  await page.addInitScript(() => {
    for (const k of ['VideoEncoder', 'AudioEncoder', 'VideoDecoder', 'AudioDecoder']) {
      Object.defineProperty(window, k, { value: undefined, configurable: true });
    }
  });
}

test('a browser without WebCodecs uses compatibility mode', async ({ page }) => {
  test.setTimeout(300_000);
  await withoutWebCodecs(page);
  await open(page);
  await compress(page, 'clip-h264-aac.mp4');
  await expect(page.getByTestId('engine-line')).toHaveText('Compatibility mode — slower in this browser', { timeout: 280_000 });
  await expect(page.getByRole('button', { name: 'Download MP4' })).toBeVisible();
});

test('cancel returns to the ready state without a result', async ({ page }) => {
  test.setTimeout(300_000);
  await withoutWebCodecs(page);
  await open(page);
  await compress(page, 'clip-h264-aac.mp4');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Compress', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Download MP4' })).toHaveCount(0);
  await expect(page.locator('[role="alert"], .text-destructive').filter({ hasText: /./ })).toHaveCount(0);
});
