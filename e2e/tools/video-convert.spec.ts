import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Video Converter: MP4/WebM/MOV/MKV on the fast engine (mediabunny), other
// inputs (AVI) on ffmpeg.wasm. Fixtures: generated test pattern + tone.
const FIX = path.join(__dirname, '..', 'fixtures', 'media');
const CORE = path.join(__dirname, '..', '..', 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');

async function convert(page: Page, fixture: string, format: string) {
  await page.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
  // ffmpeg.wasm core: R2 in production, served from node_modules here.
  await page.route('**/models/ffmpeg/*', r => r.fulfill({ path: path.join(CORE, new URL(r.request().url()).pathname.split('/').pop()!) }));
  await page.goto('/tools/video-convert/');
  await page.waitForFunction(() => {
    const i = document.querySelector('input[type="file"]');
    return !!i && Object.keys(i).some(k => k.startsWith('__reactProps'));
  });
  await page.locator('input[type="file"]').setInputFiles(path.join(FIX, fixture));
  await page.locator('select').filter({ has: page.locator('option', { hasText: 'WebM' }) }).selectOption({ label: format });
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
}

async function downloadName(page: Page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Download/ }).click()]);
  return dl.suggestedFilename();
}

test('MP4 → WebM on the fast engine', async ({ page }) => {
  test.setTimeout(120_000);
  await convert(page, 'clip-h264-aac.mp4', 'WebM (VP9)');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  await expect(page.getByTestId('result-meta')).toContainText(/vp9|av1|vp8/);
  expect(await downloadName(page)).toBe('clip-h264-aac.webm');
});

test('MP4 → MOV', async ({ page }) => {
  test.setTimeout(120_000);
  await convert(page, 'clip-h264-aac.mp4', 'MOV (H.264)');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  expect(await downloadName(page)).toBe('clip-h264-aac.mov');
});

test('WebM → MKV is offered on the fast engine', async ({ page }) => {
  test.setTimeout(120_000);
  await convert(page, 'clip-vp9-opus.webm', 'MKV (H.264)');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  expect(await downloadName(page)).toBe('clip-vp9-opus.mkv');
});

test('AVI → MP4 goes through compatibility mode', async ({ page }) => {
  test.setTimeout(300_000);
  await convert(page, 'clip.avi', 'MP4 (H.264)');
  await expect(page.getByTestId('engine-line')).toHaveText('Compatibility mode — slower in this browser', { timeout: 280_000 });
  expect(await downloadName(page)).toBe('clip.mp4');
});

test('a video the browser cannot decode falls back instead of losing its picture', async ({ page }) => {
  test.setTimeout(300_000);
  await convert(page, 'clip-undecodable.mp4', 'MP4 (H.264)');
  await expect(page.getByTestId('engine-line')).toHaveText('Compatibility mode — slower in this browser', { timeout: 280_000 });
});
