import { test, expect, chromium, type Worker } from '@playwright/test';
import path from 'node:path';

// The popup's "Capture screen" and "Record screen…" open Chrome's screen picker.
// A service worker can't open it ("A target tab is required when called from a
// service worker context"), so the offscreen document does, with getDisplayMedia.
// Chromium flags auto-pick the screen and supply a fake capture source here, so
// the real flows run end to end.
const EXT = path.join(__dirname, '..', '..', 'extension');

async function launch() {
  const ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: [
      `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`,
      '--auto-select-desktop-capture-source=Entire screen', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    ],
  });
  const isExt = (w: Worker) => w.url().startsWith('chrome-extension://');
  const sw = ctx.serviceWorkers().find(isExt) ?? (await ctx.waitForEvent('serviceworker', { predicate: isExt }));
  await expect.poll(() => sw.evaluate(() => typeof chrome !== 'undefined' && !!chrome.storage?.local), { timeout: 15_000 }).toBe(true);
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${new URL(sw.url()).host}/popup.html`);
  return { ctx, sw, popup };
}

test('"Capture screen" opens the picker, grabs a frame and opens the crop page', async () => {
  const { ctx, sw, popup } = await launch();
  try {
    const [crop] = await Promise.all([
      ctx.waitForEvent('page', p => p.url().endsWith('/select.html'), { timeout: 20_000 }),
      popup.evaluate(() => chrome.runtime.sendMessage({ type: 'capture-open' })),
    ]);
    expect(crop.url()).toContain('/select.html');
    const shot = await sw.evaluate(async () => (await chrome.storage.session.get('pendingCapture')).pendingCapture);
    expect(shot.width).toBeGreaterThan(0);
    expect(shot.dataUrl).toMatch(/^data:image\/png;base64,/);
  } finally {
    await ctx.close();
  }
});

test('"Record screen…" records through the picker and shows the result', async () => {
  test.setTimeout(60_000);
  const { ctx, popup } = await launch();
  try {
    expect(await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'rec-start', source: 'screen' }))).toMatchObject({ ok: true });
    await popup.waitForTimeout(2500);
    const [result] = await Promise.all([
      ctx.waitForEvent('page', p => p.url().endsWith('/recording.html')),
      popup.evaluate(() => chrome.runtime.sendMessage({ type: 'rec-stop' })),
    ]);
    await expect(result.locator('#meta')).toContainText(/gwt-recording-.*\.webm · 0:0[2-4] · /);
    await expect.poll(() => result.locator('#video').evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 15_000 }).toBeGreaterThan(0);
  } finally {
    await ctx.close();
  }
});
