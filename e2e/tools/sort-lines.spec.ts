import { test, expect, type Page } from '@playwright/test';

// Tool islands lazy-load via ToolHost; on a cold dev server they hydrate a few
// seconds after navigation, and a fill() before that is discarded when React
// mounts with empty initial state. Re-fill until the reactive output confirms
// the island is live.
async function typeWhenReady(page: Page, value: string, expected: string) {
  // Wait for the lazy island chunk to load + hydrate before interacting, else a
  // fill() is discarded when React mounts with empty initial state.
  await page.waitForLoadState('networkidle').catch(() => {});
  const input = page.getByPlaceholder(/Paste lines/);
  const output = page.locator('textarea[readonly]');
  await input.waitFor({ state: 'visible' });
  await expect(async () => {
    await input.fill(value);
    await expect(output).toHaveValue(expected, { timeout: 2000 });
  }).toPass({ timeout: 30_000 });
}

test('sorts lines and reacts to the order control', async ({ page }) => {
  await page.goto('/tools/sort-lines');
  await typeWhenReady(page, 'banana\napple\ncherry', 'apple\nbanana\ncherry');

  await page.locator('select:has(option[value="reverse"])').selectOption('desc');
  await expect(page.locator('textarea[readonly]')).toHaveValue('cherry\nbanana\napple');
});

test('sorts env-style lines by key with the option toggles', async ({ page }) => {
  await page.goto('/tools/sort-lines');
  // Default ascending already orders these by first letter (a < d < z).
  await typeWhenReady(page, 'ZONE=us\napi_key=1\nDB_HOST=x', 'api_key=1\nDB_HOST=x\nZONE=us');

  // Toggling sort-by-key + ignore-case keeps a valid, stable ordering.
  await page.getByLabel('Sort by key (before = or :)').check();
  await page.getByLabel('Ignore case').check();
  await expect(page.locator('textarea[readonly]')).toHaveValue('api_key=1\nDB_HOST=x\nZONE=us');
});
