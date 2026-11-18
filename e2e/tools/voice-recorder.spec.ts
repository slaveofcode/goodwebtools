import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

// Records from Chromium's synthetic microphone, so no hardware is needed.
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});

test('a voice recording has a real length and a seek index', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
  await page.goto('/tools/voice-recorder');
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent?.includes('Start recording'));
    return !!b && Object.keys(b).some(k => k.startsWith('__reactProps'));
  });
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Stop' }).click();

  const download = page.getByRole('button', { name: /^Download/ });
  await expect(download).toBeVisible({ timeout: 15_000 });
  const duration = await page.locator('audio').evaluate(async (a: HTMLAudioElement) => {
    if (a.readyState < 1) await new Promise(r => a.addEventListener('loadedmetadata', r, { once: true }));
    return a.duration;
  });
  expect(duration).toBeGreaterThan(1);
  expect(duration).toBeLessThan(4);

  const [dl] = await Promise.all([page.waitForEvent('download'), download.click()]);
  expect(dl.suggestedFilename()).toBe('recording.webm');
  const file = await fs.readFile(await dl.path());
  expect(file.includes(Buffer.from([0x1c, 0x53, 0xbb, 0x6b]))).toBe(true); // Cues
});
