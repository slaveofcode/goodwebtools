import { test, expect, type Download } from '@playwright/test';
import fs from 'node:fs/promises';

const fileOf = async (d: Download) => fs.readFile(await d.path());

// Drive the real getUserMedia + canvas + MediaRecorder pipeline with Chromium's
// synthetic camera/mic so no hardware is needed.
test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

test('records the effects canvas from the (fake) webcam and offers a download', async ({ page }) => {
  await page.goto('/tools/video-recorder');
  await page.waitForLoadState('networkidle').catch(() => {});

  const start = page.getByRole('button', { name: 'Start camera' });
  const record = page.getByRole('button', { name: 'Record', exact: true });
  await expect(async () => {
    await start.click();
    await expect(record).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });

  // Apply a colour filter — exercises the canvas-composited pipeline (no model).
  const effectSelect = page.locator('select:has(option[value="greenscreen"])');
  await effectSelect.selectOption('filter');

  await record.click();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Stop' }).click();

  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Record again' })).toBeVisible();
});

test('the recording has a real length and can be saved as MP4', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
  await page.goto('/tools/video-recorder');
  await page.waitForLoadState('networkidle').catch(() => {});
  const record = page.getByRole('button', { name: 'Record', exact: true });
  await expect(async () => {
    await page.getByRole('button', { name: 'Start camera' }).click();
    await expect(record).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await page.locator('label:has-text("3-2-1") input').uncheck().catch(() => {});

  await record.click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible({ timeout: 15_000 });

  // MediaRecorder writes WebM without a Duration or seek index (Cues); the re-packed file has both.
  const webm = await fileOf(await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()]).then(([d]) => d));
  expect(webm.includes(Buffer.from([0x1c, 0x53, 0xbb, 0x6b]))).toBe(true); // Cues
  expect(webm.includes(Buffer.from([0x44, 0x89]))).toBe(true); // Duration

  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90_000 }), page.getByRole('button', { name: 'Save as MP4' }).click()]);
  expect(dl.suggestedFilename()).toBe('video-recording.mp4');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)');
  const head = await fileOf(dl);
  expect(head.subarray(4, 8).toString('latin1')).toBe('ftyp');
});

