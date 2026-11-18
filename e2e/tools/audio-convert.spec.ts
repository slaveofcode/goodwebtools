import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Audio Converter on the fast engine (mediabunny; MP3/AAC via WASM add-ons where
// the browser has no encoder), ffmpeg.wasm otherwise. Fixture: a generated tone.
const FIX = path.join(__dirname, '..', 'fixtures', 'media');
const CORE = path.join(__dirname, '..', '..', 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');

async function convert(page: Page, format: string) {
  await page.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
  await page.route('**/models/ffmpeg/*', r => r.fulfill({ path: path.join(CORE, new URL(r.request().url()).pathname.split('/').pop()!) }));
  await page.goto('/tools/audio-convert/');
  await page.waitForFunction(() => {
    const i = document.querySelector('input[type="file"]');
    return !!i && Object.keys(i).some(k => k.startsWith('__reactProps'));
  });
  await page.locator('input[type="file"]').setInputFiles(path.join(FIX, 'tone.wav'));
  await page.locator('select').filter({ has: page.locator('option', { hasText: 'FLAC' }) }).selectOption({ label: format });
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
}

async function downloadName(page: Page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Download/ }).click()]);
  return dl.suggestedFilename();
}

test('WAV → MP3 on the fast engine (MP3 encoder add-on)', async ({ page }) => {
  test.setTimeout(120_000);
  await convert(page, 'MP3');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  expect(await downloadName(page)).toBe('tone.mp3');
});

test('WAV → M4A (AAC, via the add-on where the browser has no AAC encoder)', async ({ page }) => {
  test.setTimeout(120_000);
  await convert(page, 'M4A (AAC)');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  expect(await downloadName(page)).toBe('tone.m4a');
});

test('WAV → Opus', async ({ page }) => {
  test.setTimeout(120_000);
  await convert(page, 'Opus');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  expect(await downloadName(page)).toBe('tone.opus');
});

test('WAV → FLAC, on whichever engine this browser has', async ({ page }) => {
  test.setTimeout(300_000);
  await convert(page, 'FLAC');
  await expect(page.getByTestId('engine-line')).toBeVisible({ timeout: 280_000 });
  expect(await downloadName(page)).toBe('tone.flac');
});
