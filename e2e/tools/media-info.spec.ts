import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Media Info: container, tracks and tags read in the browser. Generic fixtures.
const FIX = path.join(__dirname, '..', 'fixtures', 'media');

async function open(page: Page, fixture: string) {
  await page.goto('/tools/media-info/');
  await page.waitForFunction(() => {
    const i = document.querySelector('input[type="file"]');
    return !!i && Object.keys(i).some(k => k.startsWith('__reactProps'));
  });
  await page.locator('input[type="file"]').setInputFiles(path.join(FIX, fixture));
}

test('shows the codecs, resolution and frame rate of an MP4', async ({ page }) => {
  await open(page, 'clip-h264-aac.mp4');
  const video = page.locator('section').filter({ hasText: 'Video track 1' });
  await expect(video).toContainText('H.264', { timeout: 20_000 });
  await expect(video).toContainText('640 × 360');
  await expect(video).toContainText('30 fps');
  await expect(page.locator('section').filter({ hasText: 'Audio track 1' })).toContainText('AAC');
  await expect(page.getByRole('button', { name: 'Copy as JSON' })).toBeVisible();
});

test('shows tags and the cover of a music file', async ({ page }) => {
  await open(page, 'tagged.m4a');
  await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Tags', exact: true }) })).toContainText('Test Tone', { timeout: 20_000 });
  await expect(page.locator('img[src^="blob:"]')).toBeVisible();
});

test('explains a format it cannot read', async ({ page }) => {
  await open(page, 'clip.avi');
  await expect(page.getByText('This file’s format can’t be read here', { exact: false })).toBeVisible({ timeout: 20_000 });
});

test('the Indonesian page labels the sections in Bahasa', async ({ page }) => {
  await page.goto('/id/tools/media-info/');
  await page.waitForFunction(() => {
    const i = document.querySelector('input[type="file"]');
    return !!i && Object.keys(i).some(k => k.startsWith('__reactProps'));
  });
  await page.locator('input[type="file"]').setInputFiles(path.join(FIX, 'clip-h264-aac.mp4'));
  await expect(page.locator('section').filter({ hasText: 'Video trek 1' })).toContainText('Resolusi', { timeout: 20_000 });
});
