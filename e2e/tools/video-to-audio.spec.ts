import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Video → Audio: "Original audio" copies the track as is (no quality loss) on
// the fast engine; MP3 re-encodes. Fixtures: generated test pattern + tone.
const FIX = path.join(__dirname, '..', 'fixtures', 'media');

async function extract(page: Page, fixture: string, format: string) {
  await page.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
  await page.goto('/tools/video-to-audio/');
  await page.waitForFunction(() => {
    const i = document.querySelector('input[type="file"]');
    return !!i && Object.keys(i).some(k => k.startsWith('__reactProps'));
  });
  await page.locator('input[type="file"]').setInputFiles(path.join(FIX, fixture));
  await page.locator('select').filter({ has: page.locator('option', { hasText: 'MP3' }) }).selectOption({ label: format });
  await page.getByRole('button', { name: 'Extract audio' }).click();
}

async function downloadName(page: Page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Download/ }).click()]);
  return dl.suggestedFilename();
}

test('original audio from an MP4 is the AAC track as .m4a, on the fast engine', async ({ page }) => {
  test.setTimeout(120_000);
  await extract(page, 'clip-h264-aac.mp4', 'Original audio (no quality loss)');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  expect(await downloadName(page)).toBe('clip-h264-aac.m4a');
});

test('original audio from a WebM is the Opus track as .ogg', async ({ page }) => {
  test.setTimeout(120_000);
  await extract(page, 'clip-vp9-opus.webm', 'Original audio (no quality loss)');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  expect(await downloadName(page)).toBe('clip-vp9-opus.ogg');
});

test('MP3 output re-encodes to .mp3', async ({ page }) => {
  test.setTimeout(120_000);
  await extract(page, 'clip-h264-aac.mp4', 'MP3');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  expect(await downloadName(page)).toBe('clip-h264-aac.mp3');
});

test('a video without audio says so', async ({ page }) => {
  test.setTimeout(120_000);
  await extract(page, 'clip-noaudio.mp4', 'Original audio (no quality loss)');
  await expect(page.getByText('This video has no audio track.')).toBeVisible({ timeout: 60_000 });
});
