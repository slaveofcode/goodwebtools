import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import zlib from 'node:zlib';

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

/** A solid-colour RGB PNG of any size (tiny on disk: the rows compress to almost nothing). */
function solidPng(width: number, height: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.alloc(1 + width * 3); for (let i = 1; i < row.length; i += 3) { row[i] = 30; row[i + 1] = 120; row[i + 2] = 200; }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function compressWide(page: Page, format: 'WebP (smaller)' | 'JPEG') {
  await open(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'panorama.png', mimeType: 'image/png', buffer: solidPng(40000, 200) });
  await page.getByRole('button', { name: format }).click();
  await page.getByRole('button', { name: 'Compress', exact: true }).click();
  await expect(resultImage(page)).not.toHaveJSProperty('naturalWidth', 0, { timeout: 60_000 });
  return resultImage(page).evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight }));
}

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

test('a very wide panorama keeps its full width as JPEG', async ({ page }) => {
  test.setTimeout(120_000);
  expect(await compressWide(page, 'JPEG')).toEqual({ w: 40000, h: 200 });
  await expect(page.getByTestId('scaled-note')).toHaveCount(0);
});

test('a very wide panorama is scaled (not squashed) to WebP’s 16383 px limit', async ({ page }) => {
  test.setTimeout(120_000);
  const { w, h } = await compressWide(page, 'WebP (smaller)');
  expect(w).toBe(16383);
  expect(h).toBe(81); // 200 × 16383 / 40000, aspect ratio kept
  await expect(page.getByTestId('scaled-note')).toContainText('Scaled down to 16383×81 px');
});

test('explains that camera RAW files (Samsung Expert RAW .dng) can’t be opened', async ({ page }) => {
  await open(page);
  // DNG is TIFF-based; a TIFF header is enough to stand in for one.
  await page.locator('input[type=file]').setInputFiles({ name: 'GALAXY_RAW.dng', mimeType: 'image/x-adobe-dng', buffer: Buffer.from([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0]) });
  await page.getByRole('button', { name: 'Compress', exact: true }).click();
  await expect(page.getByText(/Camera RAW files \(such as Samsung Expert RAW \.dng\)/)).toBeVisible();
});
