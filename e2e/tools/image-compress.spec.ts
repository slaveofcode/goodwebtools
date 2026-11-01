import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Inputs that a plain createImageBitmap() can't handle: HEIC (synthetic 64×48,
// generated with pillow-heif — also tried under a .jpg name, as phones often
// save them), SVG, and an empty file.

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="teal"/></svg>');
const heic = path.join(__dirname, '..', 'fixtures', 'synthetic.heic');

async function open(page: Page) {
  await page.goto('/tools/image-compress');
  await page.waitForFunction(() => {
    const el = document.querySelector('input[type=file]');
    return !!el && Object.keys(el).some(k => k.startsWith('__react'));
  }, undefined, { timeout: 60_000 });
}

const resultImage = (page: Page) => page.locator('img[src^="blob:"]');

test('compresses a HEIC photo, even when it is named .jpg', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  await page.locator('input[type=file]').setInputFiles(heic);
  await page.getByRole('button', { name: 'Compress', exact: true }).click();
  await expect(resultImage(page)).toHaveJSProperty('naturalWidth', 64, { timeout: 30_000 });

  await open(page);
  const fs = await import('node:fs');
  await page.locator('input[type=file]').setInputFiles({ name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(heic) });
  await page.getByRole('button', { name: 'Compress', exact: true }).click();
  await expect(resultImage(page)).toHaveJSProperty('naturalWidth', 64, { timeout: 30_000 });
});

test('compresses an SVG', async ({ page }) => {
  await open(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: SVG });
  await page.getByRole('button', { name: 'Compress', exact: true }).click();
  await expect(resultImage(page)).toHaveJSProperty('naturalWidth', 40, { timeout: 30_000 });
});

test('explains an empty file instead of a raw browser error', async ({ page }) => {
  await open(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(0) });
  await page.getByRole('button', { name: 'Compress', exact: true }).click();
  await expect(page.getByText('This file is empty — pick the image again.')).toBeVisible();
});
