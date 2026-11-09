import { test, expect, type Page } from '@playwright/test';

const STORE = 'https://chrome.google.com/webstore/detail/lpmlplhainfelpnahbjfhjmajhkcoojg';

/** Answer the site's "is the extension installed?" ping, as the extension's content script does. */
async function fakeInstalledExtension(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener('message', e => {
      if (e.source === window && e.data?.source === 'gwt-page' && e.data.type === 'ping') {
        window.postMessage({ source: 'gwt-ext', type: 'pong', id: e.data.id, version: '2.3.2' }, location.origin);
      }
    });
  });
}

test('the /extension page sells the extension with an Add to Chrome link (EN + ID)', async ({ page }) => {
  await page.goto('/extension');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('GoodWebTools for Chrome');
  await expect(page.getByTestId('add-to-chrome')).toHaveAttribute('href', STORE);
  await expect(page.locator('img[src="/extension/04-recording.webp"]')).toHaveCount(1);
  await page.goto('/id/extension');
  await expect(page.getByTestId('add-to-chrome')).toContainText('Tambahkan ke Chrome');
});

test('tool pages suggest the extension in Chrome, matched to the tool, and can hide it', async ({ page }) => {
  await page.goto('/tools/image-compress');
  const promo = page.getByTestId('extension-promo');
  await expect(promo).toBeVisible({ timeout: 30_000 });
  await expect(promo).toContainText('Right-click any image');
  await expect(promo.getByRole('link', { name: /Add to Chrome/ })).toHaveAttribute('href', STORE);

  await promo.getByRole('button', { name: 'Hide for 30 days' }).click();
  await expect(promo).toHaveCount(0);
  await page.goto('/tools/json-viewer');
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('extension-promo')).toHaveCount(0);
});

test('text tools pitch the right-click on selected text', async ({ page }) => {
  await page.goto('/tools/json-viewer');
  await expect(page.getByTestId('extension-promo')).toContainText('Select text on any page', { timeout: 30_000 });
});

test('no suggestion when the extension is already installed', async ({ page }) => {
  await fakeInstalledExtension(page);
  await page.goto('/tools/image-compress');
  await page.waitForFunction(() => { const el = document.querySelector('input[type=file]'); return !!el && Object.keys(el).some(k => k.startsWith('__react')); }, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('extension-promo')).toHaveCount(0);
});

test('no suggestion inside the extension side panel (embed mode)', async ({ page }) => {
  await page.goto('/tools/music-player/?embed=1');
  await page.waitForTimeout(2500);
  await expect(page.getByTestId('extension-promo')).toBeHidden();
});

test('the header links to the extension page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Chrome extension' })).toHaveAttribute('href', '/extension/');
});
