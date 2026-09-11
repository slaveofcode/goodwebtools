import { test, expect } from '@playwright/test';

test('support page renders with the Buy me a coffee button', async ({ page }) => {
  const res = await page.goto('/support');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: /Support GoodWebTools/i })).toBeVisible();
  // The button is a client:idle island — wait for hydration.
  await expect(page.getByRole('button', { name: 'Buy me a coffee' })).toBeVisible({ timeout: 30_000 });
});

test('header links to the support page', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle').catch(() => {});
  const link = page.locator('a[href="/support"]').first();
  await expect(link).toHaveCount(1);
});
