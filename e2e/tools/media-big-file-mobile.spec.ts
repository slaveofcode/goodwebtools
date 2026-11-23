import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// On a phone, a file the fast engine can't handle and that's too big for
// compatibility mode (ffmpeg.wasm copies it all into memory) gets a clear
// reason — instead of a long wait and "ran out of memory".
test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36' });

test('a big file the fast engine can’t read is explained, not sent to compatibility mode', async ({ page }) => {
  test.setTimeout(120_000);
  const big = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gwt-big-')), 'phone-video.mp4');
  const fd = fs.openSync(big, 'w');
  fs.ftruncateSync(fd, 320 * 1024 * 1024); // 320 MB of zeros: not a real video, too big for compatibility mode
  fs.closeSync(fd);
  let ffmpegRequested = false;
  page.on('request', r => { if (/models\/ffmpeg|ffmpeg-core/.test(r.url())) ffmpegRequested = true; });
  try {
    await page.goto('/tools/video-convert/');
    await page.waitForFunction(() => {
      const i = document.querySelector('input[type="file"]');
      return !!i && Object.keys(i).some(k => k.startsWith('__reactProps'));
    });
    await page.locator('input[type="file"]').setInputFiles(big);
    await page.getByRole('button', { name: 'Convert', exact: true }).click();
    await expect(page.getByText('can’t be processed on this device', { exact: false })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('compatibility mode can only handle files up to 300 MB here', { exact: false })).toBeVisible();
    expect(ffmpegRequested).toBe(false);
  } finally {
    fs.rmSync(path.dirname(big), { recursive: true, force: true });
  }
});
