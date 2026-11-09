import { test as base, expect, chromium, type BrowserContext, type Worker, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

// The extra tools: page text/links/password functions, the links page, two-text and
// second-box handoffs into site tools, the side panel's browse list and the popup's
// productivity row. Right-clicks can't be automated, so each piece is driven the
// way the service worker drives it.
const EXT = path.join(__dirname, '..', '..', 'extension');
const inject = fs.readFileSync(path.join(EXT, 'lib', 'inject.js'), 'utf8').replace(/^export /gm, '');

const test = base.extend<{ ctx: BrowserContext; sw: Worker; extId: string }>({
  // eslint-disable-next-line no-empty-pattern
  ctx: async ({}, use) => {
    const ctx = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
      acceptDownloads: true,
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    await use(ctx);
    await ctx.close();
  },
  sw: async ({ ctx }, use) => {
    const isExt = (w: Worker) => w.url().startsWith('chrome-extension://');
    const sw = ctx.serviceWorkers().find(isExt) ?? (await ctx.waitForEvent('serviceworker', { predicate: isExt }));
    await expect.poll(() => sw.evaluate(() => typeof chrome !== 'undefined' && !!chrome.storage?.local), { timeout: 15_000 }).toBe(true);
    await sw.evaluate(() => chrome.storage.local.set({ gwtBase: 'http://localhost:4321', gwtLang: 'en' }));
    await use(sw);
  },
  extId: async ({ sw }, use) => { await use(new URL(sw.url()).host); },
});

async function fixture(ctx: BrowserContext, html: string): Promise<Page> {
  const page = await ctx.newPage();
  await page.route('http://fixture.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://fixture.test/page');
  await page.addScriptTag({ content: inject });
  return page;
}
type W = Window & { pageText: () => { text: string }; collectPageLinks: () => { links: { href: string; text: string }[] }; insertIntoField: (t: string) => boolean };

test('page text prefers the article; links are absolute, http(s) and listed once', async ({ ctx }) => {
  const page = await fixture(ctx, `<body><nav>Menu Home About</nav><article><h1>Title</h1><p>The story.</p></article>
    <a href="/a">First</a><a href="/a"></a><a href="https://other.test/x">Other</a><a href="mailto:x@y.z">Mail</a><a href="javascript:void 0">JS</a></body>`);
  const { text } = await page.evaluate(() => (window as unknown as W).pageText());
  expect(text).toBe('Title\n\nThe story.');
  const { links } = await page.evaluate(() => (window as unknown as W).collectPageLinks());
  expect(links).toEqual([{ href: 'http://fixture.test/a', text: 'First' }, { href: 'https://other.test/x', text: 'Other' }]);
});

test('a password goes into the focused field the way typing would', async ({ ctx }) => {
  const page = await fixture(ctx, '<body><input id="pw" type="password"></body>');
  await page.evaluate(() => { (window as unknown as { __n: number }).__n = 0; document.getElementById('pw')!.addEventListener('input', () => { (window as unknown as { __n: number }).__n++; }); });
  await page.locator('#pw').focus();
  expect(await page.evaluate(() => (window as unknown as W).insertIntoField('S3cure!pass'))).toBe(true);
  await expect(page.locator('#pw')).toHaveValue('S3cure!pass');
  expect(await page.evaluate(() => (window as unknown as { __n: number }).__n)).toBeGreaterThan(0);
});

test('the links page filters, copies and exports CSV', async ({ ctx, sw, extId }) => {
  await sw.evaluate(() => chrome.storage.session.set({ pageLinks: { url: 'https://example.com/post', title: 'Post', links: [
    { href: 'https://example.com/about', text: 'About us' },
    { href: 'https://other.org/docs', text: 'Docs' },
    { href: 'https://example.com/blog', text: 'Blog' },
  ] } }));
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extId}/links.html`);
  await expect(page.locator('#from')).toHaveText('3 links from example.com');
  await expect(page.locator('#rows tr')).toHaveCount(3);
  await page.getByLabel('Other sites only').check();
  await expect(page.locator('#rows tr')).toHaveCount(1);
  await page.getByLabel('Other sites only').uncheck();
  await page.locator('#filter').fill('blog');
  await expect(page.locator('#rows tr')).toHaveCount(1);
  await page.locator('#filter').fill('');
  await page.getByRole('button', { name: 'Copy 3 URLs' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://example.com/about\nhttps://other.org/docs\nhttps://example.com/blog');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()]);
  expect(dl.suggestedFilename()).toBe('links-example.com.csv');
  expect(fs.readFileSync(await dl.path(), 'utf8').split('\n')[0]).toBe('url,text');
});

test('Compare hands both texts to Text Diff; a regex test text goes to the second box', async ({ ctx, sw, extId }) => {
  test.setTimeout(120_000);
  void sw;
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  const [diff] = await Promise.all([
    ctx.waitForEvent('page'),
    popup.evaluate(() => chrome.runtime.sendMessage({ type: 'open-tool', tool: 'text-diff', payload: { kind: 'texts', texts: ['apple\nbanana', 'apple\ncherry'] } })),
  ]);
  const boxes = diff.locator('textarea');
  await expect(boxes.nth(0)).toHaveValue('apple\nbanana', { timeout: 45_000 });
  await expect(boxes.nth(1)).toHaveValue('apple\ncherry');

  const [regex] = await Promise.all([
    ctx.waitForEvent('page'),
    popup.evaluate(() => chrome.runtime.sendMessage({ type: 'open-tool', tool: 'regex-tester', payload: { kind: 'text', text: 'call 555-1234 now', field: 1 } })),
  ]);
  await expect(regex.locator('textarea').nth(1)).toHaveValue('call 555-1234 now', { timeout: 45_000 });
});

test('the side panel browses pinned, productivity, handy and every category', async ({ ctx, sw, extId }) => {
  void sw;
  const panel = await ctx.newPage();
  await panel.setViewportSize({ width: 380, height: 800 });
  await panel.goto(`chrome-extension://${extId}/sidepanel.html`);
  await panel.locator('#find').click();
  const heads = panel.locator('#results li.head');
  await expect(heads.nth(0)).toHaveText('Pinned');
  await expect(heads.nth(1)).toHaveText('Productivity');
  await expect(heads.nth(2)).toHaveText('Handy beside a page');
  await expect(heads.nth(3)).toHaveText('Dev');
  expect(await heads.count()).toBeGreaterThan(8);
  // The default pins include Pomodoro and To-do; picking from the list switches the panel.
  // (Pinned tools also appear in their category further down.)
  await expect(panel.locator('#results li[role=option]').filter({ hasText: 'Pomodoro Timer' }).first()).toBeVisible();
  await panel.locator('#results li[role=option]').filter({ hasText: 'Time Zone Converter' }).first().click();
  await expect(panel.locator('#tool')).toHaveValue('timezone-converter');
});

test('the popup has productivity tools that open in the side panel', async ({ ctx, sw, extId }) => {
  void sw;
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await expect(popup.locator('#prodTitle')).toHaveText('Productivity — opens in the side panel');
  await expect(popup.locator('#prod button')).toHaveCount(6);
  await expect(popup.locator('#pgLinks')).toHaveText('All links');
  await expect(popup.locator('#pgPalette')).toHaveText('Color palette of this page');
  await popup.locator('#prod button', { hasText: 'Pomodoro Timer' }).click();
  // The click asks for the side panel (a real browser opens it) and switches it to that tool.
  await expect.poll(() => sw.evaluate(async () => (await chrome.storage.local.get('panelTool')).panelTool)).toBe('pomodoro-timer');
});
