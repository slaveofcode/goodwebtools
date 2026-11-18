import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { Input, BlobSource, ALL_FORMATS } from 'mediabunny';

// Remove or Replace Audio: mute (copy) and replace (copy video, encode new audio).
const FIX = path.join(__dirname, '..', 'fixtures', 'media');

async function open(page: Page, video: string) {
  await page.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
  await page.goto('/tools/video-audio-replace/');
  await page.waitForFunction(() => {
    const i = document.querySelector('input[type="file"]');
    return !!i && Object.keys(i).some(k => k.startsWith('__reactProps'));
  });
  await page.locator('input[type="file"]').setInputFiles(path.join(FIX, video));
}

async function download(page: Page) {
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible({ timeout: 120_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()]);
  return dl;
}

async function describe(file: string) {
  const input = new Input({ source: new BlobSource(new Blob([fs.readFileSync(file)])), formats: ALL_FORMATS });
  const a = await input.getPrimaryAudioTrack();
  const v = await input.getPrimaryVideoTrack();
  return { video: !!v, audio: a ? await a.getCodec() : null, duration: await input.computeDuration() };
}

test('removes the audio from a video', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, 'clip-h264-aac.mp4');
  await page.getByTestId('run').click();
  const dl = await download(page);
  expect(dl.suggestedFilename()).toBe('clip-h264-aac-muted.mp4');
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)');
  expect(await describe(await dl.path())).toMatchObject({ video: true, audio: null });
});

test('replaces the audio with another file, at the video’s length', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, 'clip-h264-aac.mp4');
  await page.getByText('Replace audio', { exact: true }).first().click();
  await page.locator('input[type="file"]').setInputFiles(path.join(FIX, 'tone.wav'));
  await page.getByTestId('run').click();
  const dl = await download(page);
  expect(dl.suggestedFilename()).toBe('clip-h264-aac-new-audio.mp4');
  const out = await describe(await dl.path());
  expect(out).toMatchObject({ video: true, audio: 'aac' });
  expect(Math.abs(out.duration - 3)).toBeLessThan(0.2);
});

test('says so when the video has no audio to remove', async ({ page }) => {
  await open(page, 'clip-noaudio.mp4');
  await page.getByTestId('run').click();
  await expect(page.getByText('This video has no audio track.')).toBeVisible({ timeout: 30_000 });
});

test('loops a shorter sound to fill the video', async ({ page }) => {
  test.setTimeout(180_000);
  await open(page, 'clip-h264-aac.mp4');
  await page.getByText('Replace audio', { exact: true }).first().click();
  await page.locator('input[type="file"]').setInputFiles(path.join(FIX, 'voice-live.webm')); // 2 s of Opus
  await page.getByTestId('run').click();
  const dl = await download(page);
  await expect(page.getByTestId('engine-line')).toHaveText('Fast mode (hardware)');
  const input = new Input({ source: new BlobSource(new Blob([fs.readFileSync(await dl.path())])), formats: ALL_FORMATS });
  const a = (await input.getPrimaryAudioTrack())!;
  expect(await a.computeDuration()).toBeGreaterThan(2.8);
});
