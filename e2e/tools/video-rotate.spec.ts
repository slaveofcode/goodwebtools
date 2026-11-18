import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { Input, BlobSource, ALL_FORMATS } from 'mediabunny';

// Rotate Video: metadata rotation (no re-encode) and "bake in" (re-encode).
const FIX = path.join(__dirname, '..', 'fixtures', 'media');

async function rotate(page: Page, button: string, bake = false, mirror = false) {
  await page.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
  await page.goto('/tools/video-rotate/');
  await page.waitForFunction(() => {
    const i = document.querySelector('input[type="file"]');
    return !!i && Object.keys(i).some(k => k.startsWith('__reactProps'));
  });
  await page.locator('input[type="file"]').setInputFiles(path.join(FIX, 'clip-h264-aac.mp4'));
  await page.getByRole('button', { name: button }).click();
  if (bake) await page.getByLabel('Bake the rotation into the picture').check();
  if (mirror) await page.getByLabel('Mirror (flip horizontally)').check();
  await page.getByRole('button', { name: 'Rotate video' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120_000 }), page.getByRole('button', { name: 'Download' }).click()]);
  return dl;
}

async function videoOf(file: string) {
  const input = new Input({ source: new BlobSource(new Blob([fs.readFileSync(file)])), formats: ALL_FORMATS });
  const v = (await input.getPrimaryVideoTrack())!;
  return { rotation: await v.getRotation(), width: await v.getCodedWidth(), height: await v.getCodedHeight(), flip: await v.getFlip() };
}

test('turns a video 90° by writing the rotation, without re-encoding', async ({ page }) => {
  test.setTimeout(120_000);
  const dl = await rotate(page, 'Right 90°');
  expect(dl.suggestedFilename()).toBe('clip-h264-aac-rotated.mp4');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)');
  const file = await dl.path();
  expect(await videoOf(file)).toEqual({ rotation: 90, width: 640, height: 360, flip: false });
  const src = fs.statSync(path.join(FIX, 'clip-h264-aac.mp4')).size;
  expect(Math.abs(fs.statSync(file).size - src) / src).toBeLessThan(0.05);
});

test('“bake in” re-encodes the picture upright', async ({ page }) => {
  test.setTimeout(180_000);
  const dl = await rotate(page, 'Right 90°', true);
  expect(await videoOf(await dl.path())).toEqual({ rotation: 0, width: 360, height: 640, flip: false });
});

test('mirrors a video without turning it', async ({ page }) => {
  test.setTimeout(120_000);
  const dl = await rotate(page, 'No turn', false, true);
  expect(await videoOf(await dl.path())).toEqual({ rotation: 0, width: 640, height: 360, flip: true });
});

