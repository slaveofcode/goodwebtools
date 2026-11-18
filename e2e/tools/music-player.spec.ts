import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Titles and cover art from the file's own tags, for formats beyond MP3.
const FIX = path.join(__dirname, '..', 'fixtures', 'media');

async function open(page: Page, fixture: string) {
  await page.goto('/tools/music-player/');
  await page.waitForFunction(() => {
    const i = document.querySelector('input[type="file"]');
    return !!i && Object.keys(i).some(k => k.startsWith('__reactProps'));
  });
  await page.locator('input[type="file"]').first().setInputFiles(path.join(FIX, fixture));
}

for (const fixture of ['tagged.m4a', 'tagged.flac']) {
  test(`shows the title, artist and cover art of ${fixture}`, async ({ page }) => {
    await open(page, fixture);
    await expect(page.locator('p.text-lg.font-black')).toHaveText('Test Tone', { timeout: 15_000 });
    await expect(page.getByText('GoodWebTools · Fixtures · 2026')).toBeVisible();
    await expect(page.locator('img[src^="blob:"]')).toBeVisible();
  });
}

test('a file without tags shows its file name', async ({ page }) => {
  await open(page, 'tone.wav');
  await expect(page.locator('p.text-lg.font-black')).toHaveText(/^tone/, { timeout: 15_000 });
  await expect(page.locator('img[src^="blob:"]')).toHaveCount(0);
});
