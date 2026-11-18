import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { unzipSync } from 'fflate';

// Video Frame Grabber: one frame as PNG, and a frame every N seconds as a zip.
const FIX = path.join(__dirname, '..', 'fixtures', 'media');

async function open(page: Page) {
  await page.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
  await page.goto('/tools/video-frames/');
  await page.waitForFunction(() => {
    const i = document.querySelector('input[type="file"]');
    return !!i && Object.keys(i).some(k => k.startsWith('__reactProps'));
  });
  await page.locator('input[type="file"]').setInputFiles(path.join(FIX, 'clip-h264-aac.mp4'));
  await page.waitForFunction(() => (document.querySelector('video[controls]') as HTMLVideoElement | null)?.readyState! >= 1);
}

test('saves the current frame as a full-size PNG', async ({ page }) => {
  await open(page);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.getByRole('button', { name: 'Save this frame' }).click()]);
  expect(dl.suggestedFilename()).toBe('clip-h264-aac-00m00.000s.png');
  const png = fs.readFileSync(await dl.path());
  expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(png.readUInt32BE(16)).toBe(640); // IHDR width
  expect(png.readUInt32BE(20)).toBe(360);
});

test('saves a frame every second as a zip', async ({ page }) => {
  await open(page);
  await page.getByLabel('Every (seconds)').fill('1');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.getByRole('button', { name: 'Save frames as zip' }).click()]);
  expect(dl.suggestedFilename()).toBe('clip-h264-aac-frames.zip');
  const files = Object.keys(unzipSync(new Uint8Array(fs.readFileSync(await dl.path())))).sort();
  expect(files).toEqual(['clip-h264-aac-00m00.000s.png', 'clip-h264-aac-00m01.000s.png', 'clip-h264-aac-00m02.000s.png']);
  await expect(page.getByRole('status').filter({ hasText: 'Saved 3 frames.' })).toBeVisible();
});

test('still works in a browser without WebCodecs (uses the video player)', async ({ page }) => {
  await page.addInitScript(() => { for (const k of ['VideoDecoder', 'VideoEncoder', 'AudioDecoder', 'AudioEncoder']) delete (window as unknown as Record<string, unknown>)[k]; });
  await open(page);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.getByRole('button', { name: 'Save this frame' }).click()]);
  const png = fs.readFileSync(await dl.path());
  expect(png.readUInt32BE(16)).toBe(640);
});

test('a second zip in the same page still has every frame', async ({ page }) => {
  await open(page);
  await page.getByLabel('Every (seconds)').fill('1');
  for (let run = 0; run < 2; run++) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.getByRole('button', { name: 'Save frames as zip' }).click()]);
    expect(Object.keys(unzipSync(new Uint8Array(fs.readFileSync(await dl.path()))))).toHaveLength(3);
  }
});
