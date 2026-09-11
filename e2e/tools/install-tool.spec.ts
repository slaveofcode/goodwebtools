import { test, expect } from '@playwright/test';

test('tool page links its own per-tool manifest', async ({ page }) => {
  const res = await page.goto('/tools/markdown');
  expect(res?.status()).toBe(200);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifests/markdown.webmanifest');
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect(apple).toBe('/manifests/icons/markdown-180.png');
});

test('shows the install button when a beforeinstallprompt is available', async ({ page }) => {
  await page.goto('/tools/markdown');
  await page.waitForLoadState('networkidle').catch(() => {});

  // Simulate an installable browser (headless Chromium never fires this itself).
  const install = page.getByRole('button', { name: 'Install this tool' });
  await expect(async () => {
    await page.evaluate(() => {
      const w = window as unknown as { __gwtInstall: { evt: unknown } };
      w.__gwtInstall = { evt: { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) } };
      window.dispatchEvent(new Event('gwt-installable'));
    });
    await expect(install).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
});
