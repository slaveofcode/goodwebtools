import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Media Trimmer: lossless cut on the fast engine (mediabunny). Fixtures are a
// generated test pattern + tone (scripts/make-media-fixtures.sh).
const FIX = path.join(__dirname, '..', 'fixtures', 'media');

async function trim(page: Page, fixture: string, start: string, end: string) {
  await page.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
  await page.goto('/tools/media-trim/');
  await page.waitForFunction(() => {
    const i = document.querySelector('input[type="file"]');
    return !!i && Object.keys(i).some(k => k.startsWith('__reactProps'));
  });
  await page.locator('input[type="file"]').setInputFiles(path.join(FIX, fixture));
  const [startBox, endBox] = [page.locator('label', { hasText: 'Start' }).locator('input'), page.locator('label', { hasText: 'End' }).locator('input')];
  await expect(endBox).not.toHaveValue('0:00');
  await startBox.fill(start);
  await endBox.fill(end);
  await page.getByRole('button', { name: 'Trim', exact: true }).click();
}

test('cuts an MP4 losslessly on the fast engine, to the requested length', async ({ page }) => {
  test.setTimeout(120_000);
  await trim(page, 'clip-h264-aac.mp4', '0:00.5', '0:02');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  const secs = Number((await page.getByTestId('result-meta').textContent())!.replace(' s', ''));
  expect(secs).toBeGreaterThan(1.3);
  expect(secs).toBeLessThan(1.7);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()]);
  expect(dl.suggestedFilename()).toBe('clip-h264-aac-trimmed.mp4');
});

test('cuts a WAV and keeps it a WAV', async ({ page }) => {
  test.setTimeout(120_000);
  await trim(page, 'tone.wav', '0:00', '0:01');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()]);
  expect(dl.suggestedFilename()).toBe('tone-trimmed.wav');
});

test('cuts a WebM and keeps it a WebM', async ({ page }) => {
  test.setTimeout(120_000);
  await trim(page, 'clip-vp9-opus.webm', '0:01', '0:02');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)', { timeout: 90_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()]);
  expect(dl.suggestedFilename()).toBe('clip-vp9-opus-trimmed.webm');
});
