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
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
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
