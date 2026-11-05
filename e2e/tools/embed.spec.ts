import { test, expect } from '@playwright/test';

// ?embed=1 is how the Companion extension's side panel shows a tool: just the tool.
test('embed mode shows only the tool', async ({ page }) => {
  await page.goto('/tools/json-viewer/?embed=1');
  await expect(page.getByRole('button', { name: 'Sample' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('html')).toHaveClass(/\bembed\b/);
  await expect(page.locator('header').first()).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toBeHidden();
  await expect(page.locator('nav[aria-label]').first()).toBeHidden();
  await expect(page.getByRole('heading', { name: /frequently asked questions/i })).toBeHidden();
});

test('without embed the page keeps its header and SEO sections', async ({ page }) => {
  await page.goto('/tools/json-viewer/');
  await expect(page.locator('html')).not.toHaveClass(/\bembed\b/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: /frequently asked questions/i })).toBeVisible();
});
