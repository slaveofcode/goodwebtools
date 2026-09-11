import { test, expect } from '@playwright/test';

test('support page renders with the Buy me a coffee button', async ({ page }) => {
  const res = await page.goto('/support');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: /Support GoodWebTools/i })).toBeVisible();
  // The CTA is a plain link that opens Polar's hosted checkout in a new tab
  // (scoped by its Polar href — the header coffee icon shares the label).
  const cta = page.locator('a[href*="buy.polar.sh"]');
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('target', '_blank');
  await expect(cta).toContainText('Buy me a coffee');
});

test('header links to the support page', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle').catch(() => {});
  const link = page.locator('a[href="/support"]').first();
  await expect(link).toHaveCount(1);
});
