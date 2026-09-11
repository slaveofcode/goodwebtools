import { test, expect } from '@playwright/test';

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
