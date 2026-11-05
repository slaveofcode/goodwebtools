import { test as base, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';

// Loads the unpacked Companion extension into Chromium (extensions need the full
// browser, not the headless shell) and points it at the dev server.
const EXT = path.join(__dirname, '..', '..', 'extension');

const test = base.extend<{ ctx: BrowserContext; sw: Worker; extId: string }>({
  // eslint-disable-next-line no-empty-pattern
  ctx: async ({}, use) => {
    const ctx = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: [
        `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`,
      ],
    });
    await use(ctx);
    await ctx.close();
  },
  sw: async ({ ctx }, use) => {
    const isExt = (w: Worker) => w.url().startsWith('chrome-extension://');
    const sw = ctx.serviceWorkers().find(isExt) ?? (await ctx.waitForEvent('serviceworker', { predicate: isExt }));
    // Right after start-up the worker's chrome.* APIs can still be undefined; wait for them.
    await expect.poll(() => sw.evaluate(() => typeof chrome !== 'undefined' && !!chrome.storage?.local), { timeout: 15_000 }).toBe(true);
    await sw.evaluate(() => chrome.storage.local.set({ gwtBase: 'http://localhost:4321', gwtLang: 'en' }));
    await use(sw);
  },
  extId: async ({ sw }, use) => { await use(new URL(sw.url()).host); },
});

test('the launcher finds a tool and opens it on the site', async ({ ctx, sw, extId }) => {
  void sw;
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.locator('#q').fill('json view');
  await expect(popup.locator('#results li').first()).toContainText('JSON Viewer');
  const [tab] = await Promise.all([ctx.waitForEvent('page'), popup.locator('#q').press('Enter')]);
  await tab.waitForLoadState();
  expect(tab.url()).toBe('http://localhost:4321/tools/json-viewer/');
});

test('the launcher searches Indonesian names and keeps favorites', async ({ ctx, sw, extId }) => {
  void sw;
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.locator('.lang button[data-lang="id"]').click();
  await popup.locator('#q').fill('penampil json');
  await expect(popup.locator('#results li').first()).toContainText('Penampil JSON');
  await popup.locator('#results li').first().locator('.star').click();
  await popup.locator('#q').fill('');
  await expect(popup.locator('#favs li')).toContainText('Penampil JSON');
});

test('data handed over by the extension lands in the tool page', async ({ ctx, sw, extId }) => {
  void sw;
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  // Same path a right-click "View as JSON tree" takes: store the payload, open the tool, hand it over.
  const [tab] = await Promise.all([
    ctx.waitForEvent('page'),
    popup.evaluate(() => chrome.runtime.sendMessage({ type: 'open-tool', tool: 'json-viewer', payload: { kind: 'text', text: '{"picked":"from the web"}' } })),
  ]);
  await expect(tab.locator("[data-path='$.picked']")).toContainText('"from the web"', { timeout: 45_000 });
  // The single-use id is gone from the URL.
  await expect.poll(() => new URL(tab.url()).hash).toBe('');
});

test('the side panel shows a tool in embed mode and switches tools', async ({ ctx, sw, extId }) => {
  void sw;
  const panel = await ctx.newPage();
  await panel.setViewportSize({ width: 380, height: 800 });
  await panel.goto(`chrome-extension://${extId}/sidepanel.html`);
  // Music Player first, shown without the site's header and SEO sections.
  await expect(panel.locator('#tool')).toHaveValue('music-player');
  const frame = panel.frameLocator('#frame');
  await expect(frame.getByText('Drop music files or click to choose')).toBeVisible({ timeout: 45_000 });
  await expect(frame.locator('nav[aria-label]').first()).toBeHidden();
  await expect(frame.getByText('Frequently asked questions', { exact: false })).toBeHidden();

  // Switch tools from the pinned list, then find and pin another one.
  await panel.locator('#tool').selectOption('json-viewer');
  await expect(frame.getByRole('button', { name: 'Sample' })).toBeVisible({ timeout: 45_000 });
  await panel.locator('#find').click();
  await panel.locator('#q').fill('base64');
  await panel.locator('#q').press('Enter');
  await expect(panel.locator('#tool')).toHaveValue('base64');
  await panel.locator('#pin').click();
  await expect(panel.locator('#pin')).toHaveAttribute('aria-pressed', 'true');
  expect(await panel.evaluate(async () => (await chrome.storage.local.get('panelTools')).panelTools)).toContain('base64');
});

test('a recording is saved and shown with download and tool handoff', async ({ ctx, sw, extId }) => {
  // Chrome only allows tab/screen capture after a real click on the extension, so
  // the recorder is fed a generated stream (canvas video + tone) here; everything
  // after capture — recording, saving, the result page, handoff — is the real code.
  test.setTimeout(90_000);
  void sw;
  const host = await ctx.newPage();
  await host.goto(`chrome-extension://${extId}/mic.html`);
  await host.evaluate(async () => {
    const { recordStream } = await import('/lib/recorder.js');
    const { saveRecording } = await import('/lib/recordings-db.js');
    const canvas = Object.assign(document.createElement('canvas'), { width: 320, height: 240 });
    const g = canvas.getContext('2d')!;
    let frame = 0;
    const timer = setInterval(() => { g.fillStyle = `hsl(${(frame++ * 12) % 360} 70% 50%)`; g.fillRect(0, 0, 320, 240); }, 33);
    const audio = new AudioContext();
    const osc = audio.createOscillator();
    const dest = audio.createMediaStreamDestination();
    osc.connect(dest);
    osc.start();
    const session = recordStream(new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]));
    await new Promise(r => setTimeout(r, 2500));
    const { blob, durationMs } = await session.stop();
    clearInterval(timer);
    await saveRecording({ blob, type: blob.type, durationMs, at: Date.now() });
  });

  const result = await ctx.newPage();
  await result.goto(`chrome-extension://${extId}/recording.html`);
  await expect(result.locator('#meta')).toContainText(/gwt-recording-.*\.webm · 0:0[2-4] · /);
  await expect.poll(() => result.locator('#video').evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 15_000 }).toBe(320);
  await expect(result.locator('#download')).toHaveAttribute('download', /\.webm$/);

  // Hand the recording to the site's Video Converter.
  const [tool] = await Promise.all([ctx.waitForEvent('page', p => p.url().includes('/tools/video-convert/')), result.locator('#toMp4').click()]);
  await expect(tool.getByText(/gwt-recording-.*\.webm/).first()).toBeVisible({ timeout: 45_000 });
});

test('recording without a tab or picker choice reports why, and nothing is left running', async ({ ctx, sw, extId }) => {
  void sw;
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  // No user click on the extension → Chrome refuses tab capture; the state stays clean.
  const res = await popup.evaluate(async () => {
    const t = await chrome.tabs.getCurrent();
    return chrome.runtime.sendMessage({ type: 'rec-start', source: 'tab', tabId: t!.id });
  });
  expect(res.ok).toBe(false);
  expect(await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'rec-state' }))).toMatchObject({ state: null });
  await expect(popup.locator('#recIdle')).toBeVisible();
});
