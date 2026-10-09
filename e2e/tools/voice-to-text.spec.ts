import { test, expect, type Page } from '@playwright/test';

// `?e2e` swaps the Whistle engine for a dev-only scripted stub (see
// src/tools/media/whistle.stub.ts), so no model is downloaded in CI.

/** A tiny synthetic WAV: 1 s of a 440 Hz tone, 16 kHz mono 16-bit. */
function toneWav(seconds = 1, rate = 16000): Buffer {
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), 44 + i * 2);
  return buf;
}

/** Replace the microphone with an oscillator so live dictation runs headless. */
async function fakeMicrophone(page: Page) {
  await page.addInitScript(() => {
    const md = navigator.mediaDevices;
    if (!md) return;
    md.getUserMedia = async () => {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const dest = ctx.createMediaStreamDestination();
      osc.connect(dest);
      osc.start();
      return dest.stream;
    };
  });
}

/** The island lazy-hydrates; wait until React owns the language picker. */
async function waitForIsland(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(
    () => {
      const el = document.querySelector('select:has(option[value="indonesian"])');
      return !!el && Object.keys(el).some(k => k.startsWith('__reactProps'));
    },
    undefined,
    { timeout: 45_000 },
  );
}

const languagePicker = (page: Page) => page.locator('select:has(option[value="indonesian"])');

test('defaults to the Fast model and switches to Whisper for Indonesian', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/tools/voice-to-text?e2e');
  await waitForIsland(page);

  await expect(page.getByRole('button', { name: 'Fast · 7 languages' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('checkbox', { name: 'Live dictation' })).toBeEnabled();

  await languagePicker(page).selectOption('indonesian');
  await expect(page.getByRole('button', { name: 'Multilingual', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Fast doesn’t support Indonesian (Bahasa) — switched to Multilingual.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Live dictation' })).toBeDisabled();

  // Back to Fast: the unsupported language resets to auto-detect.
  await page.getByRole('button', { name: 'Fast · 7 languages' }).click();
  await expect(languagePicker(page)).toHaveValue('');
});

test('Indonesian pages default to Whisper with Bahasa selected', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/id/tools/voice-to-text?e2e');
  await waitForIsland(page);
  await expect(languagePicker(page)).toHaveValue('indonesian');
  await expect(page.getByRole('button', { name: 'Multibahasa', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('transcribes a file with the Fast engine', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/tools/voice-to-text?e2e');
  await waitForIsland(page);
  await page.locator('input[type="file"]').setInputFiles({ name: 'tone.wav', mimeType: 'audio/wav', buffer: toneWav() });
  await page.getByRole('button', { name: 'Transcribe', exact: true }).click();
  await expect(page.locator('textarea')).toHaveValue('Stub transcript from the fast engine.', { timeout: 30_000 });

  await page.getByRole('button', { name: 'Subtitles' }).click();
  await expect(page.locator('pre', { hasText: '-->' })).toContainText('00:00:00,000 -->');
});

test('live dictation streams words and keeps the transcript', async ({ page }) => {
  test.setTimeout(90_000);
  await fakeMicrophone(page);
  await page.goto('/tools/voice-to-text?e2e');
  await waitForIsland(page);

  await page.getByRole('checkbox', { name: 'Live dictation' }).check();
  await page.getByRole('button', { name: 'Live dictation' }).click();
  await expect(page.getByTestId('live-transcript')).toContainText('live1', { timeout: 30_000 });
  await expect(page.getByTestId('live-transcript')).toContainText('listening…');

  await page.getByRole('button', { name: /Stop live/ }).click();
  await expect(page.locator('textarea')).toHaveValue(/^live1.* done\.$/, { timeout: 30_000 });
  // The live recording is kept for replay.
  await expect(page.locator('audio')).toBeVisible();
});
