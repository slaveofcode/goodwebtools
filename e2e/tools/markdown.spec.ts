import { test, expect } from '@playwright/test';
import path from 'node:path';

const SAMPLE = path.join(__dirname, '../fixtures/sample.md');

test('opens a local .md file and renders it in the preview', async ({ page }) => {
  await page.goto('/tools/markdown');
  await page.waitForLoadState('networkidle').catch(() => {});

  const input = page.locator('input[type="file"]');
  await input.waitFor({ state: 'attached' });

  // Loading a file switches to reading (Preview) mode and renders the doc.
  await expect(async () => {
    await input.setInputFiles(SAMPLE);
    await expect(page.getByRole('heading', { name: 'Sample Heading' })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });

  // The file name is shown.
  await expect(page.getByText('sample.md')).toBeVisible();
});

test('toggles a full-screen reading view', async ({ page }) => {
  await page.goto('/tools/markdown');
  await page.waitForLoadState('networkidle').catch(() => {});

  const expand = page.getByRole('button', { name: 'Full screen' });
  await expect(async () => {
    await expand.click();
    // Native fullscreen may be denied in headless, but the CSS overlay still
    // engages and the control flips to "Exit".
    await expect(page.getByRole('button', { name: 'Exit' })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Exit' }).click();
  await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible();
});
